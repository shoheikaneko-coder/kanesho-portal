const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-kanesho-test",
    firestore: {
      rules: fs.readFileSync("test.rules", "utf8"),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    
    // Role Permissions
    await db.collection("m_role_permissions").doc("Admin").set({ permissions: ["payroll_manage", "master_hub"] });
    await db.collection("m_role_permissions").doc("PayrollStaff").set({ permissions: ["payroll_manage"] });
    await db.collection("m_role_permissions").doc("Staff").set({ permissions: [] });
    await db.collection("m_role_permissions").doc("StoreManager").set({ permissions: ["ops_hub"] });
    await db.collection("m_role_permissions").doc("Tablet").set({ permissions: ["ops_hub"] });

    // Auth Users
    await db.collection("m_auth_users").doc("uid_admin").set({ employeeId: "emp_admin", role: "Admin", status: "active" });
    await db.collection("m_auth_users").doc("uid_payroll").set({ employeeId: "emp_payroll", role: "PayrollStaff", status: "active" });
    await db.collection("m_auth_users").doc("uid_staff").set({ employeeId: "emp_staff", role: "Staff", status: "active" });
    await db.collection("m_auth_users").doc("uid_manager").set({ employeeId: "emp_manager", role: "StoreManager", status: "active" });
    await db.collection("m_auth_users").doc("uid_tablet").set({ employeeId: "emp_tablet", role: "Tablet", status: "active" });
    await db.collection("m_auth_users").doc("uid_retired").set({ employeeId: "emp_retired", role: "Staff", status: "retired" });

    // Initial Salary Event
    await db.collection("t_salary_events").doc("evt_1").set({ employeeId: "emp_staff", amount: 1000 });
    // Dummy Business Data
    await db.collection("t_dummy_business_data").doc("dummy_1").set({ data: "test" });
  });
});

describe("M0.5 Security Rules Tests - Final Confirmation", () => {
  it("未認証ユーザー -> 給与データ DENY", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("t_salary_events").doc("evt_1").get());
  });

  it("一般社員(Staff) -> 給与データ DENY (自身のデータであっても内部台帳のため拒否)", async () => {
    const staffDb = testEnv.authenticatedContext("uid_staff").firestore();
    await assertFails(staffDb.collection("t_salary_events").doc("evt_1").get());
  });

  it("アルバイト(等、権限なし) -> 給与データ DENY", async () => {
    const staffDb = testEnv.authenticatedContext("uid_staff").firestore();
    await assertFails(staffDb.collection("t_salary_events").doc("evt_1").get());
  });

  it("店長(StoreManager, payroll_manageなし) -> 権限のない給与操作 DENY", async () => {
    const managerDb = testEnv.authenticatedContext("uid_manager").firestore();
    await assertFails(managerDb.collection("t_salary_events").doc("evt_1").get());
  });

  it("店舗タブレット(Tablet) -> 給与データ DENY", async () => {
    const tabletDb = testEnv.authenticatedContext("uid_tablet").firestore();
    await assertFails(tabletDb.collection("t_salary_events").doc("evt_1").get());
  });

  it("給与担当(PayrollStaff, payroll_manage保持) -> 給与データ ALLOW", async () => {
    const payrollDb = testEnv.authenticatedContext("uid_payroll").firestore();
    await assertSucceeds(payrollDb.collection("t_salary_events").doc("evt_1").get());
    await assertSucceeds(payrollDb.collection("t_salary_events").doc("evt_new").set({ employeeId: "emp_staff", amount: 5000 }));
  });

  it("管理者(Admin, payroll_manage保持) -> 給与データ ALLOW", async () => {
    const adminDb = testEnv.authenticatedContext("uid_admin").firestore();
    await assertSucceeds(adminDb.collection("t_salary_events").doc("evt_1").get());
  });

  it("給与担当(PayrollStaff) -> 給与イベントの物理削除 DENY", async () => {
    const payrollDb = testEnv.authenticatedContext("uid_payroll").firestore();
    await assertFails(payrollDb.collection("t_salary_events").doc("evt_1").delete());
  });

  it("管理者(Admin) -> 給与イベントの物理削除 DENY", async () => {
    const adminDb = testEnv.authenticatedContext("uid_admin").firestore();
    await assertFails(adminDb.collection("t_salary_events").doc("evt_1").delete());
  });

  it("給与担当(PayrollStaff) -> 監査履歴(t_salary_events_history)への作成 ALLOW", async () => {
    const payrollDb = testEnv.authenticatedContext("uid_payroll").firestore();
    await assertSucceeds(payrollDb.collection("t_salary_events_history").doc("hist_1").set({ eventId: "evt_1", action: "CREATE" }));
  });

  it("管理者(Admin) -> 監査履歴の更新・削除 DENY", async () => {
    const adminDb = testEnv.authenticatedContext("uid_admin").firestore();
    await assertFails(adminDb.collection("t_salary_events_history").doc("hist_1").update({ action: "CANCEL" }));
    await assertFails(adminDb.collection("t_salary_events_history").doc("hist_1").delete());
  });

  it("一般社員 -> m_auth_usersのrole変更 DENY", async () => {
    const staffDb = testEnv.authenticatedContext("uid_staff").firestore();
    await assertFails(staffDb.collection("m_auth_users").doc("uid_staff").update({ role: "Admin" }));
  });

  it("status == retired のユーザー -> 業務データへのアクセス DENY", async () => {
    const retiredDb = testEnv.authenticatedContext("uid_retired").firestore();
    await assertFails(retiredDb.collection("t_dummy_business_data").doc("dummy_1").get());
  });

  it("status == active のユーザー -> 業務データへのアクセス ALLOW", async () => {
    const activeDb = testEnv.authenticatedContext("uid_staff").firestore();
    await assertSucceeds(activeDb.collection("t_dummy_business_data").doc("dummy_1").get());
  });
});
