/**
 * かね将ポータル：マニュアル機能モジュール
 * [PC・タブレット表示に完全特化した設計]
 */

// 1. 各カテゴリの構造化マニュアルデータ (計9本)
export const MANUALS_DATA = [
    // --- カテゴリ1: かね将ポータルの使い方 ---
    {
        id: 'manual_portal_intro',
        title: '初めての方へ：ポータルの基本機能',
        category: 'portal',
        categoryName: 'かね将ポータルの使い方',
        icon: 'fa-compass',
        color: '#4f46e5',
        desc: 'ログイン手順、ホーム画面の見方、日常の業務でよく使うメニューへの導線を一通り解説します。',
        author: 'システム開発チーム',
        updatedAt: '2026/05/22',
        readTime: '3分',
        sections: [
            {
                title: '1. ポータルへのログイン手順',
                content: `
                    <p>ポータルには、管理者より支給された「メールアドレス（ログインID）」と「パスワード」を使用してログインします。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>ブラウザでアクセス</strong>
                                ログインURL（Kaneshow-portal.web.app）を開きます。PC・タブレットどちらも同一URLです。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>IDとパスワードの入力</strong>
                                支給された認証情報を入力し、「ログイン」ボタンを押下します。
                            </div>
                        </div>
                    </div>
                    <div class="manual-alert manual-alert-note">
                        <i class="fas fa-info-circle"></i>
                        <strong>パスワードを忘れた場合:</strong><br>
                        ログインボタンの下にある「パスワードを忘れた方はこちら」をクリックすると、店舗名と名前を入力するフォームが表示されます。そこから「LINEで依頼する」を押すと、管理者にパスワード再発行定型文を即座に送信できます。
                    </div>
                `
            },
            {
                title: '2. ホーム画面（ダッシュボード）の見方',
                content: `
                    <p>ログイン後に最初に表示される「メインホーム」には、本日の業務に必要な情報が集約されています。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>本日の売上サマリー（管理者・店長のみ）</strong>
                                当月累計売上や、今日の予算達成率が美しいグラフと数値で表示されます。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>通知センター</strong>
                                右上のベルアイコン（通知バッジ）に赤い点がついている場合、本部からの連絡や、シフトの公開情報が届いています。クリックして詳細を確認してください。
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: '3. 基本ナビゲーションとパンくずリスト',
                content: `
                    <p>画面の左側（タブレットの場合は左スワイプまたはハンバーガーボタンで展開）に、アクセス可能な「ハブメニュー」が表示されます。</p>
                    <p>各画面の最上部には<strong>「パンくずリスト（例：ホーム ＞ 業務 ＞ 在庫・調達）」</strong>が表示され、現在地を視覚的に把握できるようになっています。パンくずリスト内の項目をクリックすることで、前の階層のハブ画面へワンタップで戻ることができます。</p>
                `
            }
        ]
    },
    {
        id: 'manual_portal_notify',
        title: '通知機能とプロフィールの変更',
        category: 'portal',
        categoryName: 'かね将ポータルの使い方',
        icon: 'fa-bell',
        color: '#3b82f6',
        desc: '本部からのお知らせやシフト確定のプッシュ通知確認、自身の登録情報や表示名の変更方法。',
        author: 'システム開発チーム',
        updatedAt: '2026/05/18',
        readTime: '2分',
        sections: [
            {
                title: '1. 通知の受け取りと確認',
                content: `
                    <p>かね将ポータルでは、以下の重要なタイミングでシステム通知が送信されます。</p>
                    <ul>
                        <li>店長会議の新しい資料がアップロードされたとき</li>
                        <li>月次の目標予算が設定・確定されたとき</li>
                        <li>新しい確定シフトが店長によって公開されたとき</li>
                    </ul>
                    <p>ヘッダーのベルアイコンをクリックすると「通知センター」が開き、過去30日分の通知をタイムライン形式で美麗に一覧確認できます。</p>
                `
            },
            {
                title: '2. プロフィール名と表示の確認',
                content: `
                    <p>サイドバーの最上部に、現在ログインしているスタッフの名前と権限ロール（管理者、店長、一般社員、アルバイトなど）が表示されます。</p>
                    <div class="manual-alert manual-alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>お名前の漢字やロールが異なっている場合:</strong><br>
                        給与計算やシフトの割り当てロジックに影響が出る恐れがあります。誤りを発見した場合は速やかに店長または管理者（金子）へ連絡し、マスタの修正を依頼してください。自分で直接変更することはできません。
                    </div>
                `
            }
        ]
    },
    {
        id: 'manual_portal_support',
        title: '困ったときのヘルプ・問い合わせ先',
        category: 'portal',
        categoryName: 'かね将ポータルの使い方',
        icon: 'fa-circle-question',
        color: '#10b981',
        desc: '画面が動かなくなった、エラーが表示された、パスワードを変更したい等のトラブルシューティング。',
        author: '運用サポート',
        updatedAt: '2026/05/12',
        readTime: '3分',
        sections: [
            {
                title: '1. 画面がフリーズした・反応しないとき',
                content: `
                    <p>ネットワークの一時的な瞬断やセッション切れにより、画面の更新が止まる場合があります。以下のステップで復旧を試みてください。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>ブラウザの再読み込み（リロード）</strong>
                                PCの場合は「F5キー」またはURLバーの更新ボタン、iPadの場合は右上の更新マークをタップします。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>再ログイン</strong>
                                改善しない場合は、サイドバー最下部の「ログアウト」をクリックし、一度ログアウトしてから再度ID・パスワードを入力してログインし直してください。
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: '2. システムエラー画面が表示された場合',
                content: `
                    <p>画面に「Error loading page」等の赤い文字やエラーログが表示された場合、不具合が発生している可能性があります。</p>
                    <div class="manual-alert manual-alert-danger">
                        <i class="fas fa-bug"></i>
                        <strong>エラー発生時の推奨対応:</strong><br>
                        エラーコードが表示されている画面の「スクリーンショット」を撮影し、エラーメッセージを添えてLINEグループまたは管理者の金子までご連絡ください。迅速に修正パッチを適用します。
                    </div>
                `
            }
        ]
    },

    // --- カテゴリ2: 営業 ---
    {
        id: 'manual_sales_opening',
        title: '開店準備：ホールのオープン前チェック',
        category: 'sales',
        categoryName: '営業',
        icon: 'fa-store',
        color: '#f59e0b',
        desc: 'ホールの電気系統、POSレジの起動、朝礼の実施、かね将のれんの設置と外回り清掃手順。',
        author: '営業本部',
        updatedAt: '2026/05/15',
        readTime: '4分',
        sections: [
            {
                title: '1. 開店1時間前の店舗入りと設備起動',
                content: `
                    <p>店舗に入ったら、まず全体の設備チェックを行います。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>解錠と換気・電気系統のON</strong>
                                セキュリティを解除し、換気扇およびホール・キッチンの照明、エアコンを適正温度（夏24℃、冬22℃）で起動します。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>POSレジ・ハンディの起動</strong>
                                POSレジの電源を入れ、本日の釣銭用金庫の残高（規定額：10万円）に過不足がないか数えて確認し、レジにセットします。
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: '2. 店舗外回りの準備（かね将の顔）',
                content: `
                    <p>のれんや看板は、かね将の看板そのものです。細心の注意を払って設置してください。</p>
                    <ul>
                        <li><strong>のれんの設置</strong>: しわがないか、前後左右が逆になっていないかを確認してしっかりと掛けます。</li>
                        <li><strong>外回り清掃</strong>: 店舗入り口から半径5メートルのゴミ拾い、喫煙スペースの灰皿の掃除、打ち水（夏場）を徹底します。</li>
                        <li><strong>看板のライト点灯</strong>: 夜間営業に備え、看板の電球切れがないか開店前に一度点灯チェックを行います。</li>
                    </ul>
                `
            },
            {
                title: '3. オープン直前の朝礼と目標共有',
                content: `
                    <p>開店15分前にはホール・キッチン全スタッフで朝礼を行います。</p>
                    <div class="manual-alert manual-alert-note">
                        <i class="fas fa-users"></i>
                        <strong>朝礼での共有必須事項:</strong><br>
                        1. 本日の売上目標と客数ターゲット（ポータルの「月次計画」から今日の数字を共有）<br>
                        2. 予約状況とVIP顧客の有無、特別対応のアレルギー情報<br>
                        3. 本日のおすすめメニュー、売り込み強化商品、および欠品・仕込み状況
                    </div>
                `
            }
        ]
    },
    {
        id: 'manual_sales_report',
        title: '営業報告のやり方と売上入力',
        category: 'sales',
        categoryName: '営業',
        icon: 'fa-calculator',
        color: '#f97316',
        desc: '閉店後にポータルへ営業実績（売上・来客数・客単価・天気・特記事項）を正しく報告する手順。',
        author: '経理部',
        updatedAt: '2026/05/20',
        readTime: '3分',
        sections: [
            {
                title: '1. POSデータとの数値突き合わせ',
                content: `
                    <p>ポータルに入力する数値は、税務・会計の監査対象となる非常に重要なデータです。必ずPOSレジの「日計表」を印刷し、1円単位まで一致していることを確認してください。</p>
                    <div class="manual-alert manual-alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>注意点:</strong><br>
                        万が一、レジ内の現金実残高とPOS上の数字に乖離（違算）がある場合は、自己判断で数値を調整せず、必ず違算額をメモした上で、POS上の正式な売上数値をポータルに入力してください。
                    </div>
                `
            },
            {
                title: '2. 営業実績報告フォームへの入力',
                content: `
                    <p>ポータルの「営業実績報告」メニューを開き、以下のステップで入力を行います。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>基本情報の入力</strong>
                                報告日付、担当者名、天気（晴・曇・雨など）、曜日イベントなどを入力します。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>数値データの正確な入力</strong>
                                「総売上高」「現金売上」「クレジット/QR売上」「総客数」「客単価」を日計表を見ながら入力します。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">3</div>
                            <div class="manual-step-content">
                                <strong>「特記事項」の入力（最重要）</strong>
                                その日の営業における重要な出来事（例：「団体客キャンセルにより売上減」「雨のため客足鈍い」「おすすめの刺身が完売し好評」など）を具体的に記入してください。本部の社長や管理者が店舗の状態を把握するために必ず読みます。
                            </div>
                        </div>
                    </div>
                `
            }
        ]
    },
    {
        id: 'manual_sales_closing',
        title: 'クローズ作業：レジ締めと戸締まり',
        category: 'sales',
        categoryName: '営業',
        icon: 'fa-lock',
        color: '#ef4444',
        desc: '深夜営業終了後のレジ金確定、金庫への売上金回収、キッチンの火の元・施錠確認フロー。',
        author: '総務部',
        updatedAt: '2026/05/10',
        readTime: '3分',
        sections: [
            {
                title: '1. レジ金確定と売上金の金庫回収',
                content: `
                    <p>営業終了後、POSレジの「精算・締め処理」を行います。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>釣銭準備金の取り分け</strong>
                                翌日用の釣銭準備金（規定：10万円）を小銭・紙幣バランスよくレジ内に残し、残りの「当日の現金売上金」をすべて取り出します。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>売上袋への収納と金庫保管</strong>
                                取り出した売上金を専用の売上袋に入れ、日付と金額を記入し、事務所の耐火金庫に速やかに投入して二重ロックを掛けます。
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: '2. キッチンの火の元・衛生管理チェック',
                content: `
                    <p>店舗火災の予防および衛生事故防止のため、退店前にキッチンを徹底チェックします。</p>
                    <ul>
                        <li><strong>ガス元栓の閉鎖</strong>: すべての焼き台、ガスコンロの元栓が横向き（閉）になっていることを指差し確認します。</li>
                        <li><strong>ダクト・換気扇の停止</strong>: キッチンの大容量排気ダクトを停止し、異音や異常な発熱がないか確認します。</li>
                        <li><strong>生ゴミの処理と排水溝の清掃</strong>: 虫や臭気の発生を防ぐため、生ゴミは指定の回収袋へまとめ、排水溝にゴミが残っていない状態にします。</li>
                    </ul>
                `
            },
            {
                title: '3. 電気の消灯と施錠フロー',
                content: `
                    <div class="manual-alert manual-alert-danger">
                        <i class="fas fa-shield-halved"></i>
                        <strong>戸締まり厳守チェックリスト:</strong><br>
                        1. 裏口のドアが内側から施錠され、カンヌキが掛かっていることを物理的に手で引いて確認する。<br>
                        2. ホールのエアコン、モニター、BGMアンプの電源が完全に切れていることを目視確認する。<br>
                        3. 表口から退店し、鍵をしっかりと掛け、防犯セキュリティ（セコム等）をセットする。セット時の警戒ランプ点灯を確認すること。
                    </div>
                `
            }
        ]
    },

    // --- カテゴリ3: 製造 ---
    {
        id: 'manual_prep_schedule',
        title: '仕込みスケジュールと生産工程の基本',
        category: 'prep',
        categoryName: '製造',
        icon: 'fa-mortar-pestle',
        color: '#10b981',
        desc: '秘伝のタレやスープの仕込みタイミング、セントラルキッチン（CK）でのバッチ生産計画の立て方。',
        author: '総料理長',
        updatedAt: '2026/05/21',
        readTime: '5分',
        sections: [
            {
                title: '1. かね将伝統・焼きダレの仕込みサイクル',
                content: `
                    <p>かね将の焼きダレは、継ぎ足しをベースにしながらも、週に2回（火曜日と金曜日）、規定の配合でベースとなるタレを煮込み、補充仕込みを行うルールとなっています。</p>
                    <div class="manual-alert manual-alert-warning">
                        <i class="fas fa-fire-burner"></i>
                        <strong>配合比率の厳守:</strong><br>
                        タレの味はかね将の命です。醤油、みりん、各種スパイスの配合は、ミリリットル・グラム単位でレシピマスタ（ポータルの「レシピ閲覧」）に登録されています。目分量での計量は絶対に禁止します。
                    </div>
                `
            },
            {
                title: '2. セントラルキッチン（五反田CK）のバッチ生産手順',
                content: `
                    <p>セントラルキッチン（CK）では、各店舗への供給用食材（もつ煮込み、串打ち用カット肉など）を「バッチ（釜）」単位で効率的に製造します。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>発注数（需要）の集計確認</strong>
                                ポータルの「在庫・調達」画面から、各店舗より翌日配送分として届いている発注数（仕入要望）を午前10時までに集計・確認します。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>バッチ計画の作成</strong>
                                必要な総量から逆算し、大型回転釜で何釜分（何バッチ）生産するかを決定し、仕込み工程を開始します。
                            </div>
                        </div>
                    </div>
                `
            }
        ]
    },
    {
        id: 'manual_prep_inventory',
        title: '在庫管理：棚卸しのルールと単位設定',
        category: 'prep',
        categoryName: '製造',
        icon: 'fa-boxes-stacked',
        color: '#6366f1',
        desc: '店舗での日次・月次棚卸し入力ルールと、仕入れ・仕込み単位の正しい変換と選択設定。',
        author: '在庫管理部',
        updatedAt: '2026/05/19',
        readTime: '4分',
        sections: [
            {
                title: '1. 棚卸し入力のタイミングとルール',
                content: `
                    <p>実在庫とシステム在庫のズレをなくすため、かね将では以下の棚卸しスケジュールを設けています。</p>
                    <ul>
                        <li><strong>日次棚卸し</strong>: 毎日深夜の営業終了後、特定の主力食材（もつ肉、高級酒など）のみ数量をカウントして入力。</li>
                        <li><strong>月末本棚卸し</strong>: 毎月最終日の営業終了後、調味料や備品（箸、のれん、洗剤等）を含めた「全品目」のカウントを行い入力。</li>
                    </ul>
                    <p>ポータルの「在庫チェック」タブから、拠点（店舗名）を選択して、棚ごとに数量をポチポチと入力していきます。入力完了後は必ず右上の「この棚を完了」ボタンを押下してください。</p>
                `
            },
            {
                title: '2. 「発注単位」と「棚卸（在庫）単位」の重要ルール',
                content: `
                    <p>食材ごとに、業者への「発注単位」と、店舗での「カウント単位」が異なる場合があります。ポータルではこれらを自動で換算するロジックを搭載しています。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>「単位」の表記をよく確認する</strong>
                                例えば「キャベツ」を数える際、システム上の現在庫単位が「個（バラ）」なのか「箱（10玉入り）」なのかを画面の「単位」表示で必ず確認してください。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>小数点入力の活用</strong>
                                開封済みの調味料や、半分残ったキャベツなどは「0.5（半分）」や「0.2」といった小数点で入力可能です。可能な限りリアルな実在庫をカウントしてください。
                            </div>
                        </div>
                    </div>
                `
            }
        ]
    },
    {
        id: 'manual_prep_transfer',
        title: '発注と他店舗からの移動（振替）手順',
        category: 'prep',
        categoryName: '製造',
        icon: 'fa-truck-ramp-box',
        color: '#14b8a6',
        desc: '食材が足りなくなった時の「店舗間移動（振替）」の操作と、セントラルキッチン（CK）への発注（自店舗消費）連携の手順。',
        author: '仕入物流部',
        updatedAt: '2026/05/22',
        readTime: '4分',
        sections: [
            {
                title: '1. 食材ショート時の「店舗間移動（振替）」手順',
                content: `
                    <p>急な来客増等で、自店で食材が欠品しそうな場合、近隣の姉妹店から食材を緊急で融通（移動・振替）してもらうことができます。</p>
                    <div class="manual-step-list">
                        <div class="manual-step-card">
                            <div class="manual-step-num">1</div>
                            <div class="manual-step-content">
                                <strong>事前に相手店舗へ電話連絡</strong>
                                ポータルの在庫画面で相手店の在庫を確認した後、必ず電話で「〇〇を〇個、振替させてほしい」と口頭承諾を得ます。
                            </div>
                        </div>
                        <div class="manual-step-card">
                            <div class="manual-step-num">2</div>
                            <div class="manual-step-content">
                                <strong>ポータルでの「移動」の記録入力</strong>
                                「在庫・調達」＞「移動」タブを開き、移動日、品目、移動元（融通してくれる店）、移動先（自店）、移動数量を入力して「確定」します。これで両店舗の論理在庫が瞬時に同期されます。
                            </div>
                        </div>
                    </div>
                    <div class="manual-alert manual-alert-danger">
                        <i class="fas fa-hand-holding-hand"></i>
                        <strong>移動入力の漏れ厳禁:</strong><br>
                        移動の登録を行わないと、相手店舗の棚卸し時に「大赤字（原因不明の棚卸減耗）」が発生し、自店は「原因不明の過剰在庫」となってしまいます。食材の移動が発生した瞬間、その場でポータルへ登録してください。
                    </div>
                `
            },
            {
                title: '2. セントラルキッチン（CK）からの移動と自店舗消費',
                content: `
                    <p>五反田CKなどの自社キッチンから完成した「もつ煮込み」等を店舗へ送る場合は、<strong>「自店舗消費ソース」</strong>ロジックに基づき、仕入データとして自動起票されます。店舗側は納品された実物を確認し、ポータルの「仕入」タブから「受領完了」をタップするだけで、店舗側の在庫が加算されます。</p>
                `
            }
        ]
    }
];

// --- 2. マニュアル一覧（Hub）のHTMLテンプレート ---
export const manualHubPageHtml = `
    <div class="manual-hub-container animate-fade-in" style="padding-top: 1.5rem;">
        <!-- 検索バー -->
        <div class="manual-search-wrapper">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">
                <i class="fas fa-search" style="color: var(--primary); margin-right: 0.5rem;"></i>
                必要なマニュアルを今すぐ検索
            </h3>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">タイトルや説明文、キーワードを入力するとリアルタイムにマニュアルを絞り込みます。</p>
            <div class="manual-search-box">
                <i class="fas fa-magnifying-glass"></i>
                <input type="text" id="manual-search-input" class="manual-search-input" placeholder="例: ログイン、開店準備、棚卸、振替、など...">
            </div>
        </div>

        <!-- マニュアル一覧表示エリア -->
        <div id="manual-hub-sections" class="hub-sections-container">
            <!-- JSで動的にレンダリングされます -->
        </div>
    </div>

    <style>
        /* 既存の styles.css と絶対に干渉しない隔離CSS定義 */
        .manual-hub-container {
            max-width: 1200px;
            margin: 0 auto;
            padding-bottom: 5rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }
        .manual-search-wrapper {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 16px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }
        .manual-search-box {
            position: relative;
            display: flex;
            align-items: center;
        }
        .manual-search-box i {
            position: absolute;
            left: 1.2rem;
            color: var(--text-secondary);
            font-size: 1.1rem;
        }
        .manual-search-input {
            width: 100%;
            padding: 1rem 1rem 1rem 3rem;
            border: 1.5px solid var(--border);
            border-radius: 12px;
            font-size: 1rem;
            background: white;
            color: var(--text-primary);
            transition: all 0.3s ease;
            box-sizing: border-box;
        }
        .manual-search-input:focus {
            border-color: var(--primary);
            outline: none;
            box-shadow: 0 0 0 4px rgba(230, 57, 70, 0.15);
        }
        .manual-no-results {
            text-align: center;
            padding: 4rem 2rem;
            background: rgba(255,255,255,0.6);
            border-radius: 16px;
            border: 1px dashed var(--border);
            color: var(--text-secondary);
            font-size: 1rem;
        }
    </style>
`;

// --- 3. マニュアル一覧（Hub）のコントローラー・イベント初期化 ---
export function initManualHubPage() {
    const sectionsContainer = document.getElementById('manual-hub-sections');
    const searchInput = document.getElementById('manual-search-input');
    if (!sectionsContainer) return;

    // レンダリング関数
    const renderManuals = (filterText = '') => {
        const queryText = filterText.trim().toLowerCase();
        
        // データを検索キーワードでフィルタリング
        const filteredData = MANUALS_DATA.filter(m => {
            if (!queryText) return true;
            return m.title.toLowerCase().includes(queryText) || 
                   m.desc.toLowerCase().includes(queryText) || 
                   m.categoryName.toLowerCase().includes(queryText) ||
                   (m.sections && m.sections.some(s => s.title.toLowerCase().includes(queryText) || s.content.toLowerCase().includes(queryText)));
        });

        if (filteredData.length === 0) {
            sectionsContainer.innerHTML = `
                <div class="manual-no-results animate-fade-in">
                    <i class="fas fa-folder-open fa-3x" style="color: #cbd5e1; margin-bottom: 1rem; display: block;"></i>
                    <p style="margin: 0; font-weight: 600;">「${filterText}」に一致するマニュアルは見つかりませんでした。</p>
                    <p style="margin: 0.3rem 0 0; font-size: 0.8rem; color: #94a3b8;">別のキーワードで再度検索をお試しください。</p>
                </div>
            `;
            return;
        }

        // カテゴリごとにマニュアルをグループ化
        const categories = {
            'portal': { title: 'かね将ポータルの使い方', icon: 'fa-graduation-cap' },
            'sales': { title: '営業', icon: 'fa-store' },
            'prep': { title: '製造', icon: 'fa-mortar-pestle' }
        };

        let html = '';

        for (const [catKey, catMeta] of Object.entries(categories)) {
            const catItems = filteredData.filter(m => m.category === catKey);
            if (catItems.length === 0) continue;

            html += `
                <div class="hub-section animate-fade-in" style="margin-bottom: 2.5rem;">
                    <div class="hub-section-header" style="margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.6rem; border-bottom: 1.5px solid var(--border); padding-bottom: 0.6rem;">
                        <i class="fas ${catMeta.icon}" style="color: var(--primary); font-size: 1.2rem;"></i>
                        <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">${catMeta.title}</h2>
                        <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; margin-left: 0.5rem;">${catItems.length}件</span>
                    </div>
                    <div class="tile-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                        ${catItems.map(item => `
                            <div class="business-tile" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem; align-items: flex-start; background: white; border-radius: 16px; border: 1px solid var(--border); cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); min-height: 140px; position: relative;"
                                 onclick="window.navigateToManual('${item.id}')">
                                <div style="display: flex; width: 100%; align-items: center; gap: 0.8rem;">
                                    <div class="tile-icon" style="background: ${item.color}12; color: ${item.color}; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                                        <i class="fas ${item.icon}"></i>
                                    </div>
                                    <div style="flex: 1; min-width: 0; padding-right: 1.5rem;">
                                        <span class="tile-name" style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</span>
                                        <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-top: 0.1rem;">最終更新: ${item.updatedAt} • 読了: ${item.readTime}</span>
                                    </div>
                                </div>
                                <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${item.desc}</p>
                                <i class="fas fa-chevron-right tile-chevron" style="position: absolute; right: 1.2rem; top: 1.5rem; color: #cbd5e1; font-size: 0.85rem;"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        sectionsContainer.innerHTML = html;
    };

    // 初期描画
    renderManuals();

    // 検索入力イベントハンドラー
    if (searchInput) {
        searchInput.oninput = (e) => {
            renderManuals(e.target.value);
        };
        // フォーカスを自動的に当てる（PC/タブレットの入力性を高める）
        searchInput.focus();
    }
}

// --- 4. マニュアル詳細ビューアーのHTMLテンプレート ---
export const manualViewerPageHtml = `
    <div class="manual-viewer-container animate-fade-in" style="padding-top: 1.5rem;">
        <!-- 左カラム：追従型目次インデックス -->
        <aside class="manual-toc-column">
            <div class="manual-toc-title">このマニュアルの目次</div>
            <ul id="manual-toc-list" class="manual-toc-list">
                <!-- JSで動的に目次リンクが挿入されます -->
            </ul>
            <div style="margin-top: auto; border-top: 1px solid var(--border); padding-top: 1rem; text-align: center;">
                <button onclick="window.navigateTo('manual_hub')" class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                    <i class="fas fa-arrow-left"></i> マニュアル一覧に戻る
                </button>
            </div>
        </aside>

        <!-- 右カラム：マニュアル本文 -->
        <div class="manual-content-column">
            <div class="manual-paper">
                <!-- マニュアルヘッダー -->
                <div class="manual-header">
                    <div id="manual-viewer-category" style="font-size: 0.85rem; color: var(--primary); font-weight: 800; letter-spacing: 0.05em; margin-bottom: 0.4rem; text-transform: uppercase;">CATEGORY</div>
                    <h1 id="manual-viewer-title" style="margin: 0; font-size: 1.8rem; font-weight: 850; color: var(--text-primary); line-height: 1.3;">マニュアルタイトル</h1>
                    <div class="manual-meta">
                        <span><i class="fas fa-user-edit"></i> <span id="manual-viewer-author">作成者</span></span>
                        <span><i class="fas fa-clock"></i> 読了目安: <span id="manual-viewer-time">分</span></span>
                        <span><i class="fas fa-calendar-check"></i> 最終更新: <span id="manual-viewer-date">---</span></span>
                    </div>
                </div>

                <!-- マニュアルセクション本文 -->
                <div id="manual-sections-body-container">
                    <!-- JSで動的にセクションHTMLがレンダリングされます -->
                </div>
            </div>
        </div>
    </div>

    <style>
        /* ビューアー用（PC/タブレット専用2カラムレイアウト） */
        .manual-viewer-container {
            max-width: 1200px;
            margin: 0 auto;
            padding-bottom: 5rem;
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 2rem;
            position: relative;
        }
        /* 左側：Sticky目次 */
        .manual-toc-column {
            position: sticky;
            top: 100px; /* ヘッダー分空ける */
            height: calc(100vh - 140px);
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.65);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .manual-toc-title {
            font-size: 0.8rem;
            font-weight: 800;
            color: var(--text-secondary);
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.6rem;
        }
        .manual-toc-list {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .manual-toc-item {
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-decoration: none;
            padding: 0.6rem 0.8rem;
            border-radius: 8px;
            transition: all 0.2s ease;
            cursor: pointer;
            font-weight: 500;
            line-height: 1.4;
            display: block;
        }
        .manual-toc-item:hover {
            color: var(--primary);
            background: rgba(230, 57, 70, 0.04);
        }
        .manual-toc-item.active {
            color: white;
            background: var(--primary);
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(230, 57, 70, 0.15);
        }
        /* 右側：本文 */
        .manual-content-column {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }
        .manual-paper {
            background: white;
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 3rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
            box-sizing: border-box;
        }
        .manual-header {
            border-bottom: 2px solid var(--border);
            padding-bottom: 1.8rem;
            margin-bottom: 2rem;
        }
        .manual-meta {
            display: flex;
            gap: 1.5rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 0.8rem;
            align-items: center;
        }
        .manual-meta span {
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        .manual-section {
            padding-top: 1.5rem;
            margin-bottom: 3.5rem;
            scroll-margin-top: 120px; /* 目次スクロール時の余白 */
        }
        .manual-section h2 {
            font-size: 1.35rem;
            font-weight: 800;
            color: var(--text-primary);
            border-left: 5px solid var(--primary);
            padding-left: 0.8rem;
            margin-bottom: 1.2rem;
            line-height: 1.3;
        }
        .manual-section-body {
            font-size: 0.95rem;
            color: var(--text-primary);
            line-height: 1.8;
            margin-top: 0.5rem;
        }
        .manual-section-body p {
            margin-bottom: 1.2rem;
        }
        .manual-section-body ul {
            padding-left: 1.2rem;
            margin-bottom: 1.2rem;
        }
        .manual-section-body li {
            margin-bottom: 0.5rem;
        }
        /* Alertブロック */
        .manual-alert {
            border-radius: 12px;
            padding: 1.2rem 1.5rem;
            margin: 1.5rem 0;
            display: flex;
            gap: 1rem;
            align-items: flex-start;
            font-size: 0.88rem;
            line-height: 1.6;
        }
        .manual-alert i {
            font-size: 1.2rem;
            margin-top: 0.2rem;
        }
        .manual-alert-note {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            color: #1e3a8a;
        }
        .manual-alert-note i { color: #3b82f6; }
        .manual-alert-warning {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            color: #78350f;
        }
        .manual-alert-warning i { color: #f59e0b; }
        .manual-alert-danger {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            color: #7f1d1d;
        }
        .manual-alert-danger i { color: #ef4444; }
        /* 手順カード */
        .manual-step-list {
            display: flex;
            flex-direction: column;
            gap: 1.2rem;
            margin: 1.5rem 0;
        }
        .manual-step-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1.2rem 1.5rem;
            display: flex;
            gap: 1.2rem;
            align-items: flex-start;
            transition: transform 0.2s, border-color 0.2s;
        }
        .manual-step-card:hover {
            transform: translateY(-2px);
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }
        .manual-step-num {
            background: var(--primary);
            color: white;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.85rem;
            flex-shrink: 0;
            box-shadow: 0 2px 6px rgba(230, 57, 70, 0.2);
        }
        .manual-step-content {
            font-size: 0.9rem;
            line-height: 1.6;
        }
        .manual-step-content strong {
            color: var(--text-primary);
            display: block;
            margin-bottom: 0.3rem;
            font-size: 0.98rem;
        }
        /* 横幅制限などのタブレット・PC表示適正化 */
        @media (max-width: 1024px) {
            .manual-viewer-container {
                grid-template-columns: 220px 1fr;
                gap: 1.5rem;
            }
            .manual-paper {
                padding: 2rem;
            }
        }
    </style>
`;

// --- 5. マニュアル詳細ビューアーのコントローラー・イベント初期化 ---
export function initManualViewerPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const manualId = urlParams.get('id');
    const manual = MANUALS_DATA.find(m => m.id === manualId);

    if (!manual) {
        const paper = document.querySelector('.manual-paper');
        if (paper) {
            paper.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; color: var(--danger);">
                    <i class="fas fa-triangle-exclamation fa-3x" style="margin-bottom: 1rem;"></i>
                    <h2 style="margin: 0; font-size: 1.3rem;">マニュアルが見つかりませんでした</h2>
                    <p style="margin: 0.5rem 0 1.5rem; font-size: 0.85rem; color: var(--text-secondary);">削除されたか、無効なURLの可能性があります。</p>
                    <button onclick="window.navigateTo('manual_hub')" class="btn btn-primary" style="padding: 0.6rem 1.5rem;">マニュアル一覧へ戻る</button>
                </div>
            `;
        }
        return;
    }

    // 1. 各要素への基本情報インジェクション
    const catEl = document.getElementById('manual-viewer-category');
    const titleEl = document.getElementById('manual-viewer-title');
    const authorEl = document.getElementById('manual-viewer-author');
    const timeEl = document.getElementById('manual-viewer-time');
    const dateEl = document.getElementById('manual-viewer-date');
    const sectionsContainer = document.getElementById('manual-sections-body-container');
    const tocList = document.getElementById('manual-toc-list');

    if (catEl) catEl.textContent = manual.categoryName;
    if (titleEl) {
        // パンくずのパース用の一貫性を保つため、spanなどを使わずタイトルのみをテキストとして挿入
        titleEl.textContent = manual.title;
    }
    if (authorEl) authorEl.textContent = manual.author;
    if (timeEl) timeEl.textContent = manual.readTime;
    if (dateEl) dateEl.textContent = manual.updatedAt;

    // 2. 目次と本文のレンダリング
    if (sectionsContainer && tocList) {
        let sectionsHtml = '';
        let tocHtml = '';

        manual.sections.forEach((sec, idx) => {
            const secId = `manual-sec-${idx}`;
            
            // 目次リンクの追加
            tocHtml += `
                <li>
                    <a href="#${secId}" class="manual-toc-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                        ${sec.title}
                    </a>
                </li>
            `;

            // 本文の追加
            sectionsHtml += `
                <section id="${secId}" class="manual-section animate-fade-in">
                    <h2>${sec.title}</h2>
                    <div class="manual-section-body">
                        ${sec.content}
                    </div>
                </section>
            `;
        });

        tocList.innerHTML = tocHtml;
        sectionsContainer.innerHTML = sectionsHtml;
    }

    // 3. スクロールスパイ（スクロール位置に応じた目次アクティブ表示切り替え）
    const links = document.querySelectorAll('.manual-toc-item');
    const sections = document.querySelectorAll('.manual-section');
    
    const handleScroll = () => {
        let currentId = '';
        sections.forEach(sec => {
            const top = sec.offsetTop;
            // 画面上部から少し余裕を持たせた位置で判定
            if (window.scrollY >= top - 150) {
                currentId = sec.getAttribute('id');
            }
        });

        // どのセクションの上部にも達していない場合は最初のリンクをアクティブに
        if (!currentId && links.length > 0) {
            links.forEach((link, idx) => link.classList.toggle('active', idx === 0));
            return;
        }

        links.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
        });
    };

    window.addEventListener('scroll', handleScroll);

    // ページから離れるときにスクロールイベントを安全に破棄する（非干渉対策・メモリリーク防止）
    const originalShowPage = window.showPage;
    window.showPage = function() {
        window.removeEventListener('scroll', handleScroll);
        window.showPage = originalShowPage;
        return originalShowPage.apply(this, arguments);
    };

    // 4. 目次リンク押下時のスムーズスクロール処理
    links.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                window.scrollTo({
                    top: targetEl.offsetTop - 120,
                    behavior: 'smooth'
                });
                
                // URLハッシュを書き換えるが画面の急スクロールを防ぐためhistory.replaceStateを使用
                history.replaceState({ page: 'manual_viewer', id: manual.id }, "", `?page=manual_viewer&id=${manual.id}#${targetId}`);
            }
        };
    });

    // 読み込み直後にハッシュが含まれている場合はその項目にスクロール
    const hash = window.location.hash;
    if (hash) {
        const targetEl = document.getElementById(hash.substring(1));
        if (targetEl) {
            setTimeout(() => {
                window.scrollTo({
                    top: targetEl.offsetTop - 120,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }
}
