import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore/lite';
import './App.css';

function App() {
  const [lineup, setLineup] = useState({
    'dry': { current: null, queued: [] },
    'balanced': { current: null, queued: [] },
    'fruity': { current: null, queued: [] }
  });
  const [archiveLineup, setArchiveLineup] = useState({
    'dry': [], 'balanced': [], 'fruity': []
  });
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [isModalFlipped, setIsModalFlipped] = useState(false);

  // Tab state: 'active' or 'archive'
  const [activeTab, setActiveTab] = useState('dry');

  // Archive display limit
  const [displayLimit, setDisplayLimit] = useState(4);

  useEffect(() => {
    const root = document.documentElement;
    if (activeTab === 'dry') {
      root.style.setProperty('--bg-color', '#F2F2F2');
      root.style.setProperty('--accent-red', '#666666'); // 渋いグレー
    } else if (activeTab === 'balanced') {
      root.style.setProperty('--bg-color', '#F4FAEC');
      root.style.setProperty('--accent-red', '#4A8522'); // 爽やかな緑
    } else if (activeTab === 'fruity') {
      root.style.setProperty('--bg-color', '#FFF0F5');
      root.style.setProperty('--accent-red', '#E05276'); // ジューシーなピンク
    } else {
      root.style.setProperty('--bg-color', '#FAFAFA');
      root.style.setProperty('--accent-red', '#E63946'); // デフォルト赤
    }
  }, [activeTab]);

  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [mastersCache, setMastersCache] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const masterRef = collection(db, 'sake_master');
        const slotsRef = collection(db, 'daily_sake_slots');

        const [masterSnap, activeSnap] = await Promise.all([
          getDocs(query(masterRef, where('is_deleted', '==', false))),
          getDocs(query(slotsRef, where('is_deleted', '==', false), where('is_archived', '==', false)))
        ]);

        const ObjectMasters = {};
        masterSnap.forEach(doc => { ObjectMasters[doc.id] = { id: doc.id, ...doc.data() }; });
        setMastersCache(ObjectMasters);

        const activeSlots = [];
        activeSnap.forEach(doc => { activeSlots.push({ id: doc.id, ...doc.data() }); });
        activeSlots.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        const newLineup = {
          'dry': { current: null, queued: [] },
          'balanced': { current: null, queued: [] },
          'fruity': { current: null, queued: [] }
        };

        activeSlots.forEach(slot => {
          const master = ObjectMasters[slot.sake_id];
          if (!master) return;
          const type = slot.taste_type;
          if (newLineup[type]) {
            if (!newLineup[type].current) {
              newLineup[type].current = master;
            } else {
              newLineup[type].queued.push(master);
            }
          }
        });

        setLineup(newLineup);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'archive' || archiveLoaded) return;
    const fetchArchive = async () => {
      try {
        const slotsRef = collection(db, 'daily_sake_slots');
        const archSnap = await getDocs(query(slotsRef, where('is_deleted', '==', false), where('is_archived', '==', true)));
        
        const archSlots = [];
        archSnap.forEach(doc => { archSlots.push({ id: doc.id, ...doc.data() }); });
        archSlots.sort((a, b) => {
          const tA = a.updated_at?.toMillis() || 0;
          const tB = b.updated_at?.toMillis() || 0;
          return tB - tA;
        });

        const newArchive = {
          'dry': [], 'balanced': [], 'fruity': []
        };
        const seenSakeIds = new Set();

        archSlots.forEach(slot => {
          if (seenSakeIds.has(slot.sake_id)) return;
          
          const master = mastersCache[slot.sake_id];
          if (!master) return;
          const type = slot.taste_type;
          if (newArchive[type]) {
            newArchive[type].push({
              master: master,
              archivedAt: slot.updated_at?.toDate() || null
            });
            seenSakeIds.add(slot.sake_id);
          }
        });

        setArchiveLineup(newArchive);
        setArchiveLoaded(true);
      } catch (error) {
        console.error("Error fetching archive data:", error);
      }
    };
    fetchArchive();
  }, [activeTab, archiveLoaded, mastersCache]);

  const openFlipModal = (item) => {
    setSelectedArchive(item);
    setIsModalFlipped(false);
  };

  const closeFlipModal = () => {
    setSelectedArchive(null);
    setIsModalFlipped(false);
  };

  if (loading) return <div style={{padding: 40, textAlign: 'center', color: '#fff'}}>読み込み中...</div>;

  const renderCurrentCard = (type) => {
    const data = lineup[type];
    if (!data || !data.current) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-sub)' }}>
          現在、この系統の抜栓中の銘柄はありません。
        </div>
      );
    }

    const c = data.current;

    return (
      <div key={`current-${type}`} style={{ marginBottom: 40, animation: 'fadeIn 0.3s ease' }}>
        <div className="dashboard-card">
          <div className="dashboard-top">
            <div className="dashboard-image-col">
              <div className="dashboard-badge">抜栓中</div>
              <img loading="lazy" src={c.image_url || 'https://via.placeholder.com/200x300?text=No+Image'} alt={c.brand_name} className="dashboard-image" />
            </div>
            <div className="dashboard-specs-col">
              <h3 className="dash-title">{c.brand_name}</h3>
              <p className="dash-subtitle">{c.brewery_name} | {c.prefecture}</p>
              
              <div className="spec-list">
                {c.rice_type && (
                  <div className="spec-item">
                    <span className="spec-label">🌱 使用米</span>
                    <span className="spec-value">{c.rice_type}</span>
                  </div>
                )}
                {c.sake_meter_value && (
                  <div className="spec-item">
                    <span className="spec-label">🍶 日本酒度</span>
                    <span className="spec-value">{c.sake_meter_value}</span>
                  </div>
                )}
                {(c.sake_category || c.polishing_ratio) && (
                  <div className="spec-item">
                    <span className="spec-label">🏷 種別</span>
                    <span className="spec-value">{c.sake_category || (c.polishing_ratio ? c.polishing_ratio + '%' : '')}</span>
                  </div>
                )}
                {c.alcohol_percentage && (
                  <div className="spec-item">
                    <span className="spec-label">🍷 度数</span>
                    <span className="spec-value">{c.alcohol_percentage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="dashboard-bottom">
            <h4 className="dash-catchcopy">「{c.catch_copy || '究極の味わいを、今。'}」</h4>
            <p className="dash-desc">{c.detail_description || '（詳細な説明はまだ登録されていません。大将にお尋ねください！）'}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderQueuedSection = (type) => {
    const data = lineup[type];
    if (!data || data.queued.length === 0) return null;

    return (
      <div key={`queued-${type}`} style={{ marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
        <h3 style={{ fontSize: '1.1rem', borderBottom: '2px solid var(--accent-red)', paddingBottom: '8px', margin: '0 0 15px 0' }}>次に控えている銘柄</h3>
        <div className="scroll-container">
          {data.queued.map((q, idx) => (
            <div key={idx} className="poster-card">
              <img loading="lazy" src={q.image_url || 'https://via.placeholder.com/150x200?text=No+Image'} alt={q.brand_name} className="poster-image" />
              <div className="poster-content">
                <p className="poster-title">{q.brand_name}</p>
                <p className="poster-subtitle">{q.brewery_name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArchiveTab = () => {
    const hasMore = archiveLineup.fruity.length > displayLimit || 
                    archiveLineup.balanced.length > displayLimit || 
                    archiveLineup.dry.length > displayLimit;

    return (
      <div style={{ marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
        <h3 style={{ fontSize: '1.1rem', textAlign: 'center', marginBottom: '20px', color: 'var(--text-sub)' }}>
          📖 過去の提供銘柄
        </h3>
        <div className="archive-gallery">
          {/* 左列：フルーティ */}
          <div className="archive-col">
            <div className="archive-col-header">フルーティ</div>
            {archiveLineup.fruity.slice(0, displayLimit).map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img loading="lazy" src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
          {/* 中央列：バランス */}
          <div className="archive-col">
            <div className="archive-col-header">バランス</div>
            {archiveLineup.balanced.slice(0, displayLimit).map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img loading="lazy" src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
          {/* 右列：辛口 */}
          <div className="archive-col">
            <div className="archive-col-header">辛口</div>
            {archiveLineup.dry.slice(0, displayLimit).map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img loading="lazy" src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
        </div>
        
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button 
              onClick={() => setDisplayLimit(prev => prev + 4)}
              style={{
                padding: '12px 40px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '30px',
                color: '#475569',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              もっと見る ▼
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
          {/* 左側のロゴエリア（固定幅） */}
          <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img loading="lazy" src={`${import.meta.env.BASE_URL}logo.webp`} alt="かね将ロゴ" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
          
          {/* 中央のタイトルエリア */}
          <div className="header-logo" style={{ flex: 1, textAlign: 'center', fontFamily: "'Yu Mincho', 'Noto Serif JP', serif", lineHeight: 1.2 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#111' }}>酒場</span>
              <span style={{ color: '#E63946' }}>かね将</span>
              <span style={{ color: '#111' }}>地下一階</span>
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: '4px', fontWeight: 'bold', color: '#444', letterSpacing: '0.05em' }}>
              本日の純米酒
            </div>
          </div>

          {/* 右側のスペーサー（ロゴと同じ幅にすることで中央のタイトルが画面のど真ん中に来る） */}
          <div style={{ width: '70px', flexShrink: 0 }}></div>
        </div>
        <div className="tab-bar">
          <div className={`tab-item ${activeTab === 'dry' ? 'active' : ''}`} onClick={() => setActiveTab('dry')}>辛口</div>
          <div className={`tab-item ${activeTab === 'balanced' ? 'active' : ''}`} onClick={() => setActiveTab('balanced')}>バランス</div>
          <div className={`tab-item ${activeTab === 'fruity' ? 'active' : ''}`} onClick={() => setActiveTab('fruity')}>フルーティ</div>
          <div className={`tab-item ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>図鑑</div>
        </div>
      </header>

      <main className="content-area">
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        
        {['dry', 'balanced', 'fruity'].includes(activeTab) && (
          <div>
            {renderCurrentCard(activeTab)}
            {renderQueuedSection(activeTab)}
          </div>
        )}

        {activeTab === 'archive' && renderArchiveTab()}
      </main>

      {/* Flip Modal */}
      {selectedArchive && (
        <div className="flip-modal-overlay" onClick={(e) => {
          if (e.target.classList.contains('flip-modal-overlay')) closeFlipModal();
        }}>
          <div className="flip-scene">
            <button className="modal-close-btn" onClick={closeFlipModal}>&times;</button>
            <div className={`flip-card-inner ${isModalFlipped ? 'flipped' : ''}`} onClick={() => setIsModalFlipped(!isModalFlipped)}>
              {/* 表面（全面画像） */}
              <div className="flip-face flip-front">
                <img loading="lazy" src={selectedArchive.master.image_url || 'https://via.placeholder.com/300x450?text=No+Image'} alt={selectedArchive.master.brand_name} />
              </div>
              
              {/* 裏面（詳細ダッシュボード風） */}
              <div className="flip-face flip-back">
                {selectedArchive.archivedAt && (
                  <div className="flip-back-date">
                    提供終了：{selectedArchive.archivedAt.toLocaleDateString('ja-JP')}
                  </div>
                )}
                <h3 className="dash-title">{selectedArchive.master.brand_name}</h3>
                <p className="dash-subtitle">{selectedArchive.master.brewery_name} | {selectedArchive.master.prefecture}</p>
                
                <div className="spec-list" style={{ marginBottom: '15px' }}>
                  {selectedArchive.master.rice_type && (
                    <div className="spec-item"><span className="spec-label">🌱 使用米</span><span className="spec-value">{selectedArchive.master.rice_type}</span></div>
                  )}
                  {selectedArchive.master.sake_meter_value && (
                    <div className="spec-item"><span className="spec-label">🍶 日本酒度</span><span className="spec-value">{selectedArchive.master.sake_meter_value}</span></div>
                  )}
                  {(selectedArchive.master.sake_category || selectedArchive.master.polishing_ratio) && (
                    <div className="spec-item"><span className="spec-label">🏷 種別</span><span className="spec-value">{selectedArchive.master.sake_category || (selectedArchive.master.polishing_ratio ? selectedArchive.master.polishing_ratio + '%' : '')}</span></div>
                  )}
                  {selectedArchive.master.alcohol_percentage && (
                    <div className="spec-item"><span className="spec-label">🍷 度数</span><span className="spec-value">{selectedArchive.master.alcohol_percentage}</span></div>
                  )}
                </div>
                
                <h4 className="dash-catchcopy" style={{ fontSize: '0.9rem' }}>「{selectedArchive.master.catch_copy || '究極の味わい'}」</h4>
                <p className="dash-desc" style={{ fontSize: '0.75rem' }}>{selectedArchive.master.detail_description || '（詳細説明なし）'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className="nav-item active">
          <span style={{fontSize: '1.2rem', marginBottom: '4px'}}>🍶</span>
          <span>日本酒</span>
        </div>
        {/* InstagramのURLをここに設定します */}
        <a href="https://www.instagram.com/kaneshow_b1/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{textDecoration: 'none'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: '4px'}}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          <span>Instagram</span>
        </a>
      </nav>
    </div>
  );
}

export default App;
