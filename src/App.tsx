
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Menu, 
  X, 
  FolderOpen, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  Bold, 
  List as ListIcon, 
  Heading2, 
  Pencil,
  Save,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Target,
  User,
  Home,
  Lightbulb,
  ChevronDown,
  Tag
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

// Custom Quill modules
const quillModules = {
  toolbar: [
    ['bold', 'underline'],
    [{ 'background': ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#fed7aa', 'transparent'] }],
  ],
};

const quillFormats = [
  'bold', 'underline',
  'background'
];

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, loginAnonymously } from './lib/firebase';

// --- Types ---

type InsightType = 'keep' | 'improve';

interface Insight {
  id: string;
  title: string;
  keepContent: string;
  improveContent: string;
  createdAt: string;
  tags: string[];
}

interface SubCategory {
  id: string;
  label: string;
  insights: Insight[];
}

interface Category {
  id: string;
  label: string;
  icon: string; // Store icon key
  subCategories: SubCategory[];
}

interface AppData {
  categories: Category[];
  recentCategoryIds?: string[];
}

// --- Icons Helper ---
const ICON_MAP: Record<string, React.ReactNode> = {
  work: <Briefcase size={20} />,
  projects: <Target size={20} />,
  personal: <User size={20} />,
};

// --- Constants ---

const DEFAULT_DATA: AppData = {
  categories: [
    { 
      id: 'work', 
      label: 'עבודה', 
      icon: 'work',
      subCategories: [
        { id: 'leadership', label: 'מנהיגות וניהול', insights: [] },
        { id: 'tech-skills', label: 'מיומנויות טכניות', insights: [] }
      ]
    },
    { 
      id: 'projects', 
      label: 'פרויקטים', 
      icon: 'projects',
      subCategories: [
        { id: 'product-x', label: 'פרויקט אלפא', insights: [] }
      ]
    },
    { 
      id: 'personal', 
      label: 'אישי', 
      icon: 'personal',
      subCategories: [
        { id: 'habits', label: 'הרגלים יומיים', insights: [] },
        { id: 'fitness', label: 'כושר ובריאות', insights: [] }
      ]
    },
  ]
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSubNavOpen, setIsSubNavOpen] = useState(false);
  
  const [activeCategoryId, setActiveCategoryId] = useState<string>(DEFAULT_DATA.categories[0].id);
  const [activeSubId, setActiveSubId] = useState<string>(DEFAULT_DATA.categories[0].subCategories[0].id);
  const [currentView, setCurrentView] = useState<'home' | 'category'>('home');

  // Tracking visits
  const trackCategoryVisit = (catId: string) => {
    setData(prev => {
      const recents = prev.recentCategoryIds || [];
      const newRecents = [catId, ...recents.filter(id => id !== catId)].slice(0, 4);
      return { ...prev, recentCategoryIds: newRecents };
    });
  };

  // Auth & Persistence
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        loginAnonymously();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid, 'app', 'state');
    
    // Initial fetch
    const fetchInitial = async () => {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setData(snap.data() as AppData);
      } else {
        // Seed with default data
        await setDoc(docRef, DEFAULT_DATA);
      }
    };
    
    fetchInitial();

    // Listen for changes
    const unsubscribeSnapshot = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setData(snap.data() as AppData);
      }
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // Remote update helper
  useEffect(() => {
    if (!user || JSON.stringify(data) === JSON.stringify(DEFAULT_DATA)) return;
    
    const docRef = doc(db, 'users', user.uid, 'app', 'state');
    const timeoutId = setTimeout(async () => {
        try {
            await setDoc(docRef, data);
        } catch (err) {
            console.error("Failed to save to firestore", err);
        }
    }, 1000); // Debounce saves

    return () => clearTimeout(timeoutId);
  }, [data, user]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsightId, setEditingInsightId] = useState<string | null>(null);
  const [newInsight, setNewInsight] = useState<{ title: string; keepContent: string; improveContent: string; tags: string }>({
    title: '',
    keepContent: '',
    improveContent: '',
    tags: ''
  });

  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newSubCategoryLabel, setNewSubCategoryLabel] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubCategoryId, setEditingSubCategoryId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Derived state
  const activeCategory = useMemo(() => 
    data.categories.find(c => c.id === activeCategoryId), 
    [data, activeCategoryId]
  );
  
  const activeSubCategory = useMemo(() => 
    activeCategory?.subCategories.find(s => s.id === activeSubId),
    [activeCategory, activeSubId]
  );

  const insightsCount = useMemo(() => 
    data.categories.reduce((total, cat) => 
      total + cat.subCategories.reduce((subTotal, sub) => subTotal + sub.insights.length, 0), 0
    ), 
    [data]
  );

  const addCategory = () => {
    if (!newCategoryLabel.trim()) return;
    const newCat: Category = {
      id: Date.now().toString(),
      label: newCategoryLabel.trim(),
      icon: 'folder',
      subCategories: []
    };
    setData({ ...data, categories: [...data.categories, newCat] });
    setNewCategoryLabel('');
    setIsAddingCategory(false);
    setActiveCategoryId(newCat.id);
  };

  const addSubCategory = () => {
    if (!newSubCategoryLabel.trim() || !activeCategoryId) return;
    const newSub: SubCategory = {
      id: Date.now().toString(),
      label: newSubCategoryLabel.trim(),
      insights: []
    };
    const newData = { ...data };
    const catIndex = newData.categories.findIndex(c => c.id === activeCategoryId);
    if (catIndex !== -1) {
      newData.categories[catIndex].subCategories.push(newSub);
      setData(newData);
      setActiveSubId(newSub.id);
    }
    setNewSubCategoryLabel('');
    setIsAddingSubCategory(false);
  };

  const handleLogInsight = () => {
    if (!newInsight.title?.trim() || (!newInsight.keepContent?.trim() && !newInsight.improveContent?.trim())) return;

    const newData = { ...data };
    const catIndex = newData.categories.findIndex(c => c.id === activeCategoryId);
    if (catIndex === -1) return;
    
    const subIndex = newData.categories[catIndex].subCategories.findIndex(s => s.id === activeSubId);
    if (subIndex === -1) return;

    if (editingInsightId) {
      const insights = newData.categories[catIndex].subCategories[subIndex].insights;
      const index = insights.findIndex(i => i.id === editingInsightId);
      if (index !== -1) {
        insights[index] = {
          ...insights[index],
          title: newInsight.title,
          keepContent: newInsight.keepContent,
          improveContent: newInsight.improveContent,
          tags: newInsight.tags.split(',').map(t => t.trim()).filter(t => t !== '')
        };
      }
    } else {
      const entry: Insight = {
        id: Date.now().toString(),
        title: newInsight.title,
        keepContent: newInsight.keepContent,
        improveContent: newInsight.improveContent,
        createdAt: new Date().toLocaleDateString('he-IL'),
        tags: newInsight.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      };
      newData.categories[catIndex].subCategories[subIndex].insights = [
        entry,
        ...newData.categories[catIndex].subCategories[subIndex].insights
      ];
    }

    setData(newData);
    setNewInsight({ title: '', keepContent: '', improveContent: '', tags: '' });
    setEditingInsightId(null);
    setIsModalOpen(false);
  };

  const startEdit = (insight: Insight) => {
    setNewInsight({
      title: insight.title || '',
      keepContent: insight.keepContent || '',
      improveContent: insight.improveContent || '',
      tags: (insight.tags || []).join(', ')
    });
    setEditingInsightId(insight.id);
    setIsModalOpen(true);
  };

  const renameCategory = (id: string) => {
    if (!editLabel.trim()) return;
    const newData = { ...data };
    const idx = newData.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      newData.categories[idx].label = editLabel;
      setData(newData);
    }
    setEditingCategoryId(null);
    setEditLabel('');
  };

  const deleteCategory = (id: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הנושא וכל תכולתו?')) {
      const newData = { ...data };
      newData.categories = newData.categories.filter(c => c.id !== id);
      setData(newData);
      if (activeCategoryId === id && newData.categories.length > 0) {
        setActiveCategoryId(newData.categories[0].id);
      }
    }
  };

  const renameSubCategory = (id: string) => {
    if (!editLabel.trim()) return;
    const newData = { ...data };
    const catIdx = newData.categories.findIndex(c => c.id === activeCategoryId);
    if (catIdx !== -1) {
      const subIdx = newData.categories[catIdx].subCategories.findIndex(s => s.id === id);
      if (subIdx !== -1) {
        newData.categories[catIdx].subCategories[subIdx].label = editLabel;
        setData(newData);
      }
    }
    setEditingSubCategoryId(null);
    setEditLabel('');
  };

  const deleteSubCategory = (id: string) => {
    if (window.confirm('מחק תת-נושא זה?')) {
      const newData = { ...data };
      const catIdx = newData.categories.findIndex(c => c.id === activeCategoryId);
      if (catIdx !== -1) {
        newData.categories[catIdx].subCategories = newData.categories[catIdx].subCategories.filter(s => s.id !== id);
        setData(newData);
        if (activeSubId === id && newData.categories[catIdx].subCategories.length > 0) {
          setActiveSubId(newData.categories[catIdx].subCategories[0].id);
        }
      }
    }
  };

  const removeInsight = (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק תובנה זו?')) return;
    const newData = { ...data };
    const catIndex = newData.categories.findIndex(c => c.id === activeCategoryId);
    if (catIndex !== -1) {
      const subIndex = newData.categories[catIndex].subCategories.findIndex(s => s.id === activeSubId);
      if (subIndex !== -1) {
        newData.categories[catIndex].subCategories[subIndex].insights = 
          newData.categories[catIndex].subCategories[subIndex].insights.filter(i => i.id !== id);
        setData(newData);
      }
    }
  };

  // Breadcrumbs Helper
  const Breadcrumbs = () => (
    <nav className="flex items-center gap-2 text-stone-400 text-sm mb-4 md:mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <button 
        onClick={() => {
            setCurrentView('home');
            setIsMobileMenuOpen(false);
        }}
        className={`flex items-center gap-1 transition-colors ${currentView === 'home' ? 'text-stone-900 font-bold' : 'hover:text-stone-600'}`}
      >
        <Home size={14} />
        <span className="hidden sm:inline">הביתה</span>
      </button>
      {currentView === 'category' && (
        <>
            <ChevronLeft size={12} className="shrink-0" />
            <span className="hover:text-stone-600 cursor-pointer" onClick={() => setIsSubNavOpen(true)}>
                {activeCategory?.label}
            </span>
            <ChevronLeft size={12} className="shrink-0" />
            <span className="text-stone-900 font-medium">{activeSubCategory?.label}</span>
        </>
      )}
    </nav>
  );

  // --- Home View Component ---
  const HomeView = () => {
    const allInsights = useMemo(() => {
      const insights: (Insight & { catLabel: string; subLabel: string; catId: string; subId: string })[] = [];
      data.categories.forEach(cat => {
        cat.subCategories.forEach(sub => {
          sub.insights.forEach(insight => {
            insights.push({ ...insight, catLabel: cat.label, subLabel: sub.label, catId: cat.id, subId: sub.id });
          });
        });
      });
      return insights.sort((a, b) => new Date(b.createdAt.split('.').reverse().join('-')).getTime() - new Date(a.createdAt.split('.').reverse().join('-')).getTime());
    }, [data]);

    const dailyInsight = useMemo(() => {
      if (allInsights.length === 0) return null;
      // Use date as seed for "daily" random
      const today = new Date().toDateString();
      const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return allInsights[seed % allInsights.length];
    }, [allInsights]);

    const stats = [
      { label: 'תחומים', count: data.categories.length, icon: <FolderOpen size={20} className="text-brand" /> },
      { label: 'נושאים', count: data.categories.reduce((acc, c) => acc + c.subCategories.length, 0), icon: <Target size={20} className="text-brand" /> },
      { label: 'תובנות', count: insightsCount, icon: <Lightbulb size={20} className="text-brand" /> },
    ];

    return (
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        <header className="space-y-2">
          <h2 className="serif-title text-3xl md:text-4xl text-stone-900 leading-tight">בוקר טוב, מוכן לצמוח?</h2>
          <p className="text-stone-500 max-w-lg">לוח הבקרה שלך מרכז את כל מה שלמדת. הנה סקירה מהירה של מסע הלמידה שלך.</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center">
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-stone-900">{stat.count}</div>
                <div className="text-xs text-stone-400 font-bold uppercase tracking-widest">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Dashboard Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Daily Insight Card */}
            {dailyInsight && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-brand text-white p-10 rounded-[2.5rem] shadow-2xl shadow-brand/20 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Lightbulb size={120} />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    תובנה לריענון הזיכרון
                  </div>
                  <h3 className="serif-title text-2xl leading-relaxed">{dailyInsight.title}</h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setActiveCategoryId(dailyInsight.catId);
                        setActiveSubId(dailyInsight.subId);
                        setCurrentView('category');
                      }}
                      className="text-sm font-bold border-b border-white/40 hover:border-white transition-all pb-1"
                    >
                      קרא עוד בתוך {dailyInsight.subLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recent Activity */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="serif-title text-xl text-stone-900">תובנות אחרונות</h3>
                <button className="text-sm text-brand font-bold hover:underline">ראה הכל</button>
              </div>

              <div className="space-y-4">
                {allInsights.slice(0, 3).map((insight, i) => (
                  <motion.div 
                    key={insight.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => {
                        setActiveCategoryId(insight.catId);
                        setActiveSubId(insight.subId);
                        setCurrentView('category');
                    }}
                    className="bg-white p-5 rounded-2xl border border-stone-100 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 shadow-sm transition-all cursor-pointer group flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-stone-800 group-hover:text-brand transition-colors">{insight.title}</h4>
                      <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                        {insight.catLabel} › {insight.subLabel}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-stone-300 group-hover:text-brand group-hover:translate-x-[-4px] transition-all" />
                  </motion.div>
                ))}
                {allInsights.length === 0 && (
                  <div className="text-center py-10 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                    <p className="text-stone-400 text-sm">התחילו לכתוב ותראו כאן את התובנות האחרונות שלכם.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Quick Actions / Categories Column */}
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="serif-title text-base text-stone-400 font-bold uppercase tracking-widest">גישה מהירה</h3>
              <div className="grid grid-cols-1 gap-3">
                {(data.recentCategoryIds && data.recentCategoryIds.length > 0
                  ? data.recentCategoryIds.map(id => data.categories.find(c => c.id === id)).filter(Boolean) as Category[]
                  : data.categories.slice(0, 4)
                ).map((cat) => (
                  <button 
                    key={cat.id}
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setCurrentView('category');
                      trackCategoryVisit(cat.id);
                      if (cat.subCategories.length > 0) {
                        setActiveSubId(cat.subCategories[0].id);
                      }
                    }}
                    className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm hover:border-brand/40 group transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-accent-soft group-hover:text-brand transition-all">
                      {ICON_MAP[cat.icon] || <FolderOpen size={18} />}
                    </div>
                    <span className="font-bold text-stone-700 text-sm">{cat.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full py-6 bg-stone-900 text-white rounded-3xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <Plus size={20} />
              </div>
              <span>תובנה חדשה</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-notebook-cream font-sans selection:bg-stone-200">

      
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: isMobileMenuOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? '100%' : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed lg:relative flex flex-col h-full border-l border-stone-200 bg-notebook-paper shadow-sm z-50`}
        style={{ right: 0 }}
      >
        <div className="p-6 flex items-center justify-between">
          <motion.h1 
            animate={{ opacity: isSidebarOpen ? 1 : 0 }}
            className="serif-title text-xl text-stone-800 whitespace-nowrap"
          >
            הצמיחה שלי
          </motion.h1>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hidden lg:block"
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <Menu size={20} />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 mt-4 px-3 space-y-4 overflow-y-auto">
          <button 
            onClick={() => {
                setCurrentView('home');
                setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
              currentView === 'home' 
                ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                : 'hover:bg-accent-soft/50 text-stone-600 font-medium'
            }`}
          >
            <Home size={20} />
            {isSidebarOpen && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>לוח בקרה</motion.span>}
          </button>

          <div className="space-y-2">
            {data.categories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className={`group flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeCategoryId === cat.id && currentView === 'category'
                    ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                    : 'hover:bg-accent-soft/50 text-stone-600'
                }`}>
                  <button
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setCurrentView('category');
                      setIsMobileMenuOpen(false);
                      trackCategoryVisit(cat.id);
                      if (cat.subCategories.length > 0) {
                        setActiveSubId(cat.subCategories[0].id);
                      }
                    }}
                    className="flex-1 flex items-center gap-3 text-right"
                  >
                    <span className="shrink-0">{ICON_MAP[cat.icon] || <FolderOpen size={20} />}</span>
                    {isSidebarOpen && (
                      <motion.span 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="font-bold whitespace-nowrap"
                      >
                        {editingCategoryId === cat.id ? (
                          <input 
                            autoFocus
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onBlur={() => renameCategory(cat.id)}
                            onKeyDown={(e) => e.key === 'Enter' && renameCategory(cat.id)}
                            className="bg-stone-700 text-white outline-none px-1 rounded w-24"
                          />
                        ) : cat.label}
                      </motion.span>
                    )}
                  </button>
                  
                  {isSidebarOpen && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingCategoryId(cat.id); setEditLabel(cat.label); }} className="p-1 hover:bg-stone-700 rounded transition-colors text-stone-400">
                        <Pencil size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }} className="p-1 hover:bg-red-900 rounded transition-colors text-red-400">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {isSidebarOpen && activeCategoryId === cat.id && currentView === 'category' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pr-8 pl-2 py-2 space-y-1"
                  >
                    {cat.subCategories.map((sub) => (
                      <div key={sub.id} className={`group flex items-center justify-between p-2 rounded-lg transition-all ${
                        activeSubId === sub.id 
                          ? 'bg-accent-soft text-brand shadow-sm' 
                          : 'hover:bg-stone-50'
                      }`}>
                        <button
                          onClick={() => {
                            setActiveSubId(sub.id);
                            if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                          }}
                          className={`flex-1 text-right text-sm ${
                            activeSubId === sub.id ? 'font-bold' : 'text-stone-500 hover:text-stone-700'
                          }`}
                        >
                          {editingSubCategoryId === sub.id ? (
                            <input 
                              autoFocus
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              onBlur={() => renameSubCategory(sub.id)}
                              onKeyDown={(e) => e.key === 'Enter' && renameSubCategory(sub.id)}
                              className="bg-transparent border-b border-stone-400 outline-none w-24"
                            />
                          ) : sub.label}
                        </button>
                        
                        <div className="hidden group-hover:flex items-center gap-1 mr-2">
                           <button onClick={(e) => { e.stopPropagation(); setEditingSubCategoryId(sub.id); setEditLabel(sub.label); }} className="text-stone-300 hover:text-stone-600">
                             <Pencil size={10} />
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); deleteSubCategory(sub.id); }} className="text-stone-300 hover:text-red-500">
                             <X size={10} />
                           </button>
                        </div>
                        <span className="text-[10px] opacity-40 mr-1">{sub.insights.length}</span>
                      </div>
                    ))}
                    
                    {isAddingSubCategory ? (
                      <div className="flex gap-1 mt-2">
                        <input 
                          autoFocus
                          type="text" 
                          value={newSubCategoryLabel}
                          onChange={(e) => setNewSubCategoryLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubCategory()}
                          placeholder="נושא חדש..."
                          className="w-full text-sm p-1 border-b border-stone-300 bg-transparent outline-none"
                        />
                        <button onClick={addSubCategory} className="text-stone-900 hover:text-stone-600">
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsAddingSubCategory(true)}
                        className="w-full text-right p-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
                      >
                        <Plus size={12} />
                        הוסף תת-נושא
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {isSidebarOpen && (
            <div className="pt-4 border-t border-stone-100">
              {isAddingCategory ? (
                <div className="flex gap-2 p-2">
                  <input 
                    autoFocus
                    type="text"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                    placeholder="נושא ראשי חדש..."
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <button onClick={addCategory} className="bg-stone-900 text-white p-2 rounded-lg">
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAddingCategory(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-100 text-stone-400 transition-colors"
                >
                  <Plus size={20} />
                  <span className="font-medium">הוסף תחום חדש</span>
                </button>
              )}
            </div>
          )}
        </nav>

        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 mt-auto border-t border-stone-100"
          >
             <div className="flex items-center gap-3 text-stone-400 text-sm">
                <Lightbulb size={16} className={insightsCount > 0 ? "text-yellow-400 fill-yellow-400" : ""} />
                <span>יש לך {insightsCount} תובנות</span>
             </div>
          </motion.div>
        )}
      </motion.aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-notebook-paper border-b border-stone-200 p-4 flex items-center justify-between shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-stone-500">
            <Menu size={24} />
          </button>
          <h1 className="serif-title text-lg text-stone-800">הצמיחה שלי</h1>
          <div className="w-10 h-10" /> {/* Spacer */}
        </header>

        {/* Sub-categories List (Hidden on Desktop because it's now in sidebar) */}
        <AnimatePresence>
          {isSubNavOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubNavOpen(false)}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] z-30 flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9 }}
                 animate={{ scale: 1 }}
                 className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl"
                 onClick={e => e.stopPropagation()}
               >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="serif-title text-xl">בחר נושא</h3>
                    <X size={20} onClick={() => setIsSubNavOpen(false)} />
                  </div>
                  <div className="space-y-2">
                    {activeCategory?.subCategories.map(sub => (
                      <button 
                        key={sub.id}
                        onClick={() => {
                          setActiveSubId(sub.id);
                          setIsSubNavOpen(false);
                        }}
                        className={`w-full text-right p-4 rounded-2xl ${activeSubId === sub.id ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'}`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="hidden lg:block"> {/* Spacer for desktop logic if needed, but SubNav is now in sidebar */}</div>

        {/* Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto bg-page-bg relative p-6 md:p-12">
          
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs />
            
            {currentView === 'home' ? (
                <HomeView />
            ) : (
                <>
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                    <button 
                    onClick={() => setIsSubNavOpen(true)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all cursor-pointer shadow-lg shadow-brand/20"
                    >
                    <ChevronDown size={14} />
                    שינוי נושא
                    </button>
                    <h2 className="serif-title text-xl md:text-3xl text-stone-900 leading-tight">
                    {activeSubCategory?.label}
                    </h2>
                </div>
                
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="hidden md:flex items-center gap-2 bg-brand text-white px-6 py-3.5 rounded-2xl hover:bg-opacity-90 transition-all shadow-xl shadow-brand/20 hover:-translate-y-0.5 active:scale-95"
                >
                    <Plus size={18} />
                    <span className="font-bold text-sm">תובנה חדשה</span>
                </button>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-32">
                <AnimatePresence mode="popLayout" initial={false}>
                    {activeSubCategory && activeSubCategory.insights.length > 0 ? (
                    activeSubCategory.insights.map((insight) => (
                        <motion.div
                        key={insight.id}
                        layout
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className="notebook-card p-5 md:p-8 flex flex-col gap-6 group"
                        >
                        <div className="flex items-center justify-between border-b border-stone-100/60 pb-5">
                            <h3 className="serif-title text-base md:text-lg text-stone-900">{insight.title}</h3>
                            <div className="flex items-center gap-1.5 text-stone-400 text-[10px] font-bold tracking-widest whitespace-nowrap">
                            <Calendar size={12} />
                            {insight.createdAt}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {insight.keepContent && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full bg-keep-bg flex items-center justify-center">
                                    <CheckCircle2 size={10} className="text-keep-text" />
                                </div>
                                <span className="text-[10px] font-black text-keep-text uppercase tracking-widest">חוזקות לשימור</span>
                                </div>
                                <div 
                                className="rich-content text-stone-600 text-sm leading-relaxed pr-6 border-r-2 border-keep-text/20"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(insight.keepContent) }}
                                />
                            </div>
                            )}

                            {insight.improveContent && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full bg-improve-bg flex items-center justify-center">
                                    <AlertCircle size={10} className="text-improve-text" />
                                </div>
                                <span className="text-[10px] font-black text-improve-text uppercase tracking-widest">הזדמנויות לצמיחה</span>
                                </div>
                                <div 
                                className="rich-content text-stone-600 text-sm leading-relaxed pr-6 border-r-2 border-improve-text/20"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(insight.improveContent) }}
                                />
                            </div>
                            )}
                        </div>

                        <div className="mt-auto pt-6 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all">
                            <div className="flex gap-2">
                            <button 
                                onClick={() => startEdit(insight)}
                                className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                            >
                                <Pencil size={16} />
                            </button>
                            <button 
                                onClick={() => removeInsight(insight.id)}
                                className="p-2 text-stone-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <X size={16} />
                            </button>
                            </div>
                            <div className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic truncate max-w-[100px]">
                            {activeSubCategory.label}
                            </div>
                        </div>
                        </motion.div>
                    ))
                    ) : (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full py-32 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-[2rem]"
                    >
                        <motion.div 
                        animate={{ 
                            rotate: [0, 5, -5, 0],
                            scale: [1, 1.05, 1]
                        }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        >
                        <FolderOpen size={64} className="mb-6 opacity-10" />
                        </motion.div>
                        <p className="text-2xl serif-title text-stone-600">אין עדיין תובנות</p>
                        <p className="text-sm mt-1">זה הזמן להתחיל את מסע הצמיחה שלך.</p>
                        <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-8 flex items-center gap-2 bg-stone-900 text-white px-8 py-3 rounded-full hover:bg-stone-800 hover:-translate-y-0.5 transition-all shadow-xl shadow-stone-900/20"
                        >
                        <Plus size={18} />
                        תובנה ראשונה
                        </button>
                    </motion.div>
                    )}
                </AnimatePresence>
                </section>
                </>
            )}
          </div>

          {/* Floating Action Button for Mobile */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="md:hidden fixed bottom-8 right-8 w-16 h-16 bg-brand text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand/40 active:scale-95 z-30 transition-transform"
          >
            <Plus size={28} />
          </button>
        </div>
      </div>

      {/* Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-4xl relative overflow-hidden mx-4"
            >
              <div className="p-6 md:p-14">
                <div className="flex justify-between items-center mb-8 md:mb-12">
                  <h3 className="serif-title text-xl md:text-3xl text-stone-900 leading-tight">
                    {editingInsightId ? 'עריכת תובנה' : 'תובנה חדשה'}
                  </h3>
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingInsightId(null);
                        setNewInsight({ title: '', keepContent: '', improveContent: '', tags: '' });
                      }} 
                      className="text-stone-300 hover:text-stone-900 p-2.5 hover:bg-stone-50 rounded-full transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="space-y-10 max-h-[65vh] overflow-y-auto pl-4 custom-scrollbar">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 mb-3 uppercase tracking-[0.2em] opacity-80">נושא התובנה</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newInsight.title}
                      onChange={(e) => setNewInsight({ ...newInsight, title: e.target.value })}
                      placeholder="לדוגמה: ניהול ישיבות צוות..."
                      className="w-full px-0 py-4 bg-transparent border-b border-stone-100 focus:border-stone-900 outline-none text-lg md:text-xl text-stone-800 font-medium transition-all placeholder:text-stone-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-10">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-keep-text uppercase tracking-widest">מה עבד טוב היום? (חוזקות)</label>
                          <p className="text-[10px] text-stone-400 italic">זיהוי הצלחות, קטנות כגדולות, עוזר לנו לבנות ביטחון עצמי.</p>
                        </div>
                        <CheckCircle2 size={16} className="text-keep-text mb-1" />
                      </div>
                      <div className="quill-wrapper shadow-sm">
                        <ReactQuill 
                          theme="snow"
                          value={newInsight.keepContent}
                          onChange={(val) => setNewInsight(prev => ({ ...prev, keepContent: val }))}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder=""
                          className="border-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-improve-text uppercase tracking-widest">מה ניתן ללמוד לפעם הבאה? (צמיחה)</label>
                          <p className="text-[10px] text-stone-400 italic">כל אתגר הוא הזדמנות ללמידה. מה היית עושה אחרת כדי לגדול?</p>
                        </div>
                        <AlertCircle size={16} className="text-improve-text mb-1" />
                      </div>
                      <div className="quill-wrapper shadow-sm">
                        <ReactQuill 
                          theme="snow"
                          value={newInsight.improveContent}
                          onChange={(val) => setNewInsight(prev => ({ ...prev, improveContent: val }))}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder=""
                          className="border-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-stone-400 mb-2 uppercase tracking-[0.2em]">תגיות (סינון עתידי)</label>
                    <input 
                      type="text"
                      value={newInsight.tags}
                      onChange={(e) => setNewInsight({ ...newInsight, tags: e.target.value })}
                      placeholder="ניהול, טכנולוגיה..."
                      className="w-full p-3 bg-stone-50 border border-transparent rounded-xl focus:bg-white focus:border-stone-200 outline-none text-xs"
                    />
                  </div>

                  <button 
                    onClick={handleLogInsight}
                    disabled={!newInsight.title?.trim() || (!newInsight.keepContent?.trim() && !newInsight.improveContent?.trim())}
                    className="w-full py-4 bg-brand text-white rounded-2xl font-bold text-base hover:bg-opacity-90 transition-all shadow-xl shadow-brand/20 disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                  >
                    שמור במחברת
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
