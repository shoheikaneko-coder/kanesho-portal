import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
  const [activeTab, setActiveTab] = useState('dry'); // dry, balanced, fruity, archive
  
  // Modal State
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [isModalFlipped, setIsModalFlipped] = useState(false);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const masterRef = collection(db, 'sake_master');
        const masterSnap = await getDocs(query(masterRef, where('is_deleted', '==', false)));
        const masters = {};
        masterSnap.forEach(doc => { masters[doc.id] = { id: doc.id, ...doc.data() }; });

        const slotsRef = collection(db, 'daily_sake_slots');
        const activeSnap = await getDocs(query(slotsRef, where('is_deleted', '==', false), where('is_archived', '==', false)));
        const archSnap = await getDocs(query(slotsRef, where('is_deleted', '==', false), where('is_archived', '==', true)));
        
        const activeSlots = [];
        activeSnap.forEach(doc => { activeSlots.push({ id: doc.id, ...doc.data() }); });
        activeSlots.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        const archSlots = [];
        archSnap.forEach(doc => { archSlots.push({ id: doc.id, ...doc.data() }); });
        // In-memory sort by updated_at (descending) to avoid missing index errors
        archSlots.sort((a, b) => {
          const tA = a.updated_at?.toMillis() || 0;
          const tB = b.updated_at?.toMillis() || 0;
          return tB - tA;
        });

        const newLineup = {
          'dry': { current: null, queued: [] },
          'balanced': { current: null, queued: [] },
          'fruity': { current: null, queued: [] }
        };
        const newArchive = {
          'dry': [], 'balanced': [], 'fruity': []
        };

        activeSlots.forEach(slot => {
          const master = masters[slot.sake_id];
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

        archSlots.forEach(slot => {
          const master = masters[slot.sake_id];
          if (!master) return;
          const type = slot.taste_type;
          if (newArchive[type]) {
            newArchive[type].push({
              master: master,
              archivedAt: slot.updated_at?.toDate() || null
            });
          }
        });

        setLineup(newLineup);
        setArchiveLineup(newArchive);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
              <img src={c.image_url || 'https://via.placeholder.com/200x300?text=No+Image'} alt={c.brand_name} className="dashboard-image" />
            </div>
            <div className="dashboard-specs-col">
              <h3 className="dash-title">{c.brand_name}</h3>
              <p className="dash-subtitle">{c.brewery_name} | {c.prefecture}</p>
              
              <div className="spec-list">
                {c.rice_type && (
                  <div className="spec-item">
                    <span className="spec-label"><i className="fas fa-seedling"></i> 使用米</span>
                    <span className="spec-value">{c.rice_type}</span>
                  </div>
                )}
                {c.sake_meter_value && (
                  <div className="spec-item">
                    <span className="spec-label"><i className="fas fa-tachometer-alt"></i> 日本酒度</span>
                    <span className="spec-value">{c.sake_meter_value}</span>
                  </div>
                )}
                {(c.sake_category || c.polishing_ratio) && (
                  <div className="spec-item">
                    <span className="spec-label"><i className="fas fa-tag"></i> 種別</span>
                    <span className="spec-value">{c.sake_category || (c.polishing_ratio ? c.polishing_ratio + '%' : '')}</span>
                  </div>
                )}
                {c.alcohol_percentage && (
                  <div className="spec-item">
                    <span className="spec-label"><i className="fas fa-wine-glass"></i> 度数</span>
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
              <img src={q.image_url || 'https://via.placeholder.com/150x200?text=No+Image'} alt={q.brand_name} className="poster-image" />
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
    return (
      <div style={{ marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
        <h3 style={{ fontSize: '1.1rem', textAlign: 'center', marginBottom: '20px', color: 'var(--text-sub)' }}>
          <i className="fas fa-book"></i> 過去の提供銘柄
        </h3>
        <div className="archive-gallery">
          {/* 左列：フルーティ */}
          <div className="archive-col">
            <div className="archive-col-header">フルーティ</div>
            {archiveLineup.fruity.map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
          {/* 中央列：バランス */}
          <div className="archive-col">
            <div className="archive-col-header">バランス</div>
            {archiveLineup.balanced.map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
          {/* 右列：辛口 */}
          <div className="archive-col">
            <div className="archive-col-header">辛口</div>
            {archiveLineup.dry.map((item, idx) => (
              <div key={idx} className="archive-item" onClick={() => openFlipModal(item)}>
                <img src={item.master.image_url || 'https://via.placeholder.com/150'} alt={item.master.brand_name} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
          {/* 左側のロゴエリア（固定幅） */}
          <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="かね将ロゴ" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
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
                <img src={selectedArchive.master.image_url || 'https://via.placeholder.com/300x450?text=No+Image'} alt={selectedArchive.master.brand_name} />
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
                    <div className="spec-item"><span className="spec-label"><i className="fas fa-seedling"></i> 使用米</span><span className="spec-value">{selectedArchive.master.rice_type}</span></div>
                  )}
                  {selectedArchive.master.sake_meter_value && (
                    <div className="spec-item"><span className="spec-label"><i className="fas fa-tachometer-alt"></i> 日本酒度</span><span className="spec-value">{selectedArchive.master.sake_meter_value}</span></div>
                  )}
                  {(selectedArchive.master.sake_category || selectedArchive.master.polishing_ratio) && (
                    <div className="spec-item"><span className="spec-label"><i className="fas fa-tag"></i> 種別</span><span className="spec-value">{selectedArchive.master.sake_category || (selectedArchive.master.polishing_ratio ? selectedArchive.master.polishing_ratio + '%' : '')}</span></div>
                  )}
                  {selectedArchive.master.alcohol_percentage && (
                    <div className="spec-item"><span className="spec-label"><i className="fas fa-wine-glass"></i> 度数</span><span className="spec-value">{selectedArchive.master.alcohol_percentage}</span></div>
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
          <i className="fas fa-wine-bottle" style={{fontSize: '1.2rem'}}></i>
          <span>日本酒</span>
        </div>
        {/* InstagramのURLをここに設定します */}
        <a href="https://www.instagram.com/kaneshow_b1/" target="_blank" rel="noopener noreferrer" className="nav-item" style={{textDecoration: 'none'}}>
          <i className="fab fa-instagram" style={{fontSize: '1.2rem'}}></i>
          <span>Instagram</span>
        </a>
      </nav>
    </div>
  );
}

export default App;
