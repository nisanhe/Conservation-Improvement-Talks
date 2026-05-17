
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Menu, 
  X, 
  Minus,
  Search,
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
  Tag,
  LogOut,
  Trash2,
  Notebook,
  Move,
  Download,
  FolderPlus,
  BrainCircuit,
  Zap,
  Sparkles
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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

import { doc, getDoc, setDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { db, auth, loginWithGoogle, loginWithEmail, signUpWithEmail } from './lib/firebase';

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

interface Category {
  id: string;
  label: string;
  icon?: string; // Optional icon for the top-level categories
  subCategories: Category[];
  insights: Insight[];
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

// --- External Recursive Component ---
const SidebarItem = ({ 
    cat, 
    depth, 
    activeCategoryId, 
    expandedIds, 
    activeActionsId, 
    isSidebarOpen, 
    editingCategoryId, 
    editLabel,
    currentView,
    toggleExpanded, 
    setActiveCategoryId, 
    setCurrentView, 
    trackCategoryVisit, 
    setActiveActionsId, 
    setEditingCategoryId, 
    setEditLabel, 
    renameCategory, 
    deleteCategory, 
    setData, 
    updateCategoryInTree 
  }: any) => {
      const isExpanded = expandedIds.includes(cat.id);
      const isActive = activeCategoryId === cat.id;
      const [localIsAdding, setLocalIsAdding] = useState(false);
      const [localNewLabel, setLocalNewLabel] = useState('');
      const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
      const hasSubs = cat.subCategories && cat.subCategories.length > 0;
      const countInsights = (c: Category): number => {
          let count = (c.insights || []).length;
          if (c.subCategories) {
              c.subCategories.forEach(sub => {
                  count += countInsights(sub);
              });
          }
          return count;
      };
  
      const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = setTimeout(() => {
              setActiveActionsId(cat.id);
              if ('vibrate' in navigator) navigator.vibrate(50);
          }, 500);
      };
  
      const handlePointerUp = () => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
      };
  
      const handleAddChild = () => {
          if (!localNewLabel.trim()) return;
          const newSub: Category = {
              id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              label: localNewLabel.trim(),
              insights: [],
              subCategories: []
          };
          setData((prev: AppData) => ({
              ...prev,
              categories: updateCategoryInTree(prev.categories, cat.id, (c: Category) => ({
                  ...c,
                  subCategories: [...(c.subCategories || []), newSub]
              }))
          }));
          setLocalNewLabel('');
          setLocalIsAdding(false);
          setActiveCategoryId(newSub.id);
          setCurrentView('category');
      };
  
      return (
          <div className="space-y-1">
              <div 
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchEnd={handlePointerUp}
                  onClick={() => {
                      if (activeActionsId !== cat.id) {
                          toggleExpanded(cat.id);
                          if (activeCategoryId !== cat.id) {
                              setActiveCategoryId(cat.id);
                              if (currentView !== 'category') setCurrentView('category');
                              trackCategoryVisit(cat.id);
                          }
                      }
                  }}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
                      isActive && currentView === 'category'
                          ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                          : 'hover:bg-accent-soft/50 text-stone-600 font-medium'
                  }`}
                  style={{ marginRight: depth > 0 ? `${depth * 10}px` : '0', width: depth > 0 ? `calc(100% - ${depth * 10}px)` : '100%' }}
              >
                  <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isActive && currentView === 'category' ? 'bg-white/20 text-white' : 'bg-stone-50 text-stone-400 group-hover:text-brand'
                      }`}>
                          {depth === 0 ? (ICON_MAP[cat.icon!] || <FolderOpen size={16} />) : <Notebook size={14} />}
                      </div>
                      
                      {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
                          <div className="flex flex-col min-w-0">
                              {editingCategoryId === cat.id ? (
                                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                      <input 
                                          autoFocus
                                          dir="rtl"
                                          value={editLabel}
                                          onChange={(e) => setEditLabel(e.target.value)}
                                          onBlur={() => renameCategory(cat.id)}
                                          onKeyDown={(e) => e.key === 'Enter' && renameCategory(cat.id)}
                                          className="w-full bg-stone-50 border border-stone-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-brand focus:bg-white transition-all outline-none font-bold shadow-sm text-right"
                                      />
                                  </div>
                              ) : (
                                  <span className="font-bold truncate text-sm text-right">{cat.label}</span>
                              )}
                              <span className={`text-[10px] uppercase font-black tracking-widest opacity-40 transition-opacity group-hover:opacity-60`}>
                                  {countInsights(cat)} תובנות
                              </span>
                          </div>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-2 pr-2">
                      {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && activeActionsId === cat.id && (
                          <motion.div 
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-xl border border-stone-100 z-10"
                              onClick={e => e.stopPropagation()}
                          >
                              <button 
                                  onClick={(e) => { 
                                      e.stopPropagation();
                                      setEditingCategoryId(cat.id); 
                                      setEditLabel(cat.label); 
                                      setActiveActionsId(null);
                                  }} 
                                  className="p-1.5 rounded-md hover:bg-stone-100 text-stone-600 transition-colors"
                                  title="עריכה"
                              >
                                  <Pencil size={12} />
                              </button>
                              <button 
                                  onClick={(e) => { 
                                      e.stopPropagation();
                                      deleteCategory(cat.id); 
                                      setActiveActionsId(null);
                                  }} 
                                  className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                                  title="מחיקה"
                              >
                                  <Minus size={12} />
                              </button>
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveActionsId(null);
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                                  title="ביטול"
                              >
                                  <X size={12} />
                              </button>
                          </motion.div>
                      )}
  
                      {hasSubs && (
                          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={14} className="text-stone-300" />
                          </div>
                      )}
                  </div>
              </div>
  
              <AnimatePresence>
                  {isExpanded && (
                      <motion.div 
                          key={`expanded-subcategories-${cat.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1 overflow-hidden"
                      >
                          {cat.subCategories && cat.subCategories.length > 0 && cat.subCategories.map((sub: Category, i: number) => (
                              <SidebarItem 
                                  key={`${sub.id}-${i}`} 
                                  cat={sub} 
                                  depth={depth + 1}
                                  activeCategoryId={activeCategoryId}
                                  expandedIds={expandedIds}
                                  activeActionsId={activeActionsId}
                                  isSidebarOpen={isSidebarOpen}
                                  editingCategoryId={editingCategoryId}
                                  editLabel={editLabel}
                                  currentView={currentView}
                                  toggleExpanded={toggleExpanded}
                                  setActiveCategoryId={setActiveCategoryId}
                                  setCurrentView={setCurrentView}
                                  trackCategoryVisit={trackCategoryVisit}
                                  setActiveActionsId={setActiveActionsId}
                                  setEditingCategoryId={setEditingCategoryId}
                                  setEditLabel={setEditLabel}
                                  renameCategory={renameCategory}
                                  deleteCategory={deleteCategory}
                                  setData={setData}
                                  updateCategoryInTree={updateCategoryInTree}
                              />
                          ))}
                          
                          {isSidebarOpen && (
                              <div key="add-subcategory-footer" style={{ marginRight: (depth + 1) * 10 + 'px' }}>
                                  {!localIsAdding ? (
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setLocalIsAdding(true);
                                          }}
                                          className="flex items-center gap-2 p-2 text-[10px] font-bold text-stone-400 hover:text-brand transition-colors w-full text-right"
                                      >
                                          <Plus size={10} />
                                          <span>הוסף תת-נושא ל"{cat.label}"</span>
                                      </button>
                                  ) : (
                                      <div className="flex gap-1 p-1 bg-white shadow-xl rounded-xl border border-stone-100 mt-1" onClick={e => e.stopPropagation()}>
                                          <input 
                                              autoFocus
                                              type="text" 
                                              dir="rtl"
                                              value={localNewLabel}
                                              onChange={(e) => setLocalNewLabel(e.target.value)}
                                              onKeyDown={(e) => e.key === 'Enter' && handleAddChild()}
                                              onBlur={(e) => {
                                                  // Delay blur to allow button click on mobile
                                                  setTimeout(() => {
                                                      if (!localNewLabel) setLocalIsAdding(false);
                                                  }, 200);
                                              }}
                                              placeholder="שם התת-נושא..."
                                              className="w-full text-sm py-2.5 px-3 bg-stone-50 rounded-lg outline-none border border-transparent focus:ring-2 focus:ring-brand focus:bg-white transition-all text-right"
                                          />
                                          <button 
                                              onPointerDown={(e) => {
                                                  // Use onPointerDown for faster response on mobile
                                                  e.preventDefault();
                                                  handleAddChild();
                                              }} 
                                              className="text-brand p-2 hover:scale-110 transition-transform shrink-0"
                                          >
                                              <Plus size={16} />
                                          </button>
                                          <button 
                                              onClick={() => {
                                                  setLocalNewLabel('');
                                                  setLocalIsAdding(false);
                                              }} 
                                              className="text-stone-300 hover:text-stone-500"
                                          >
                                              <X size={14} />
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>
      );
  };
  

// --- Constants ---

const DEFAULT_DATA: AppData = {
  categories: [
    { 
      id: 'work', 
      label: 'עבודה', 
      icon: 'work',
      insights: [],
      subCategories: [
        { id: 'leadership', label: 'מנהיגות וניהול', insights: [], subCategories: [] },
        { id: 'tech-skills', label: 'מיומנויות טכניות', insights: [], subCategories: [] }
      ]
    },
    { 
      id: 'projects', 
      label: 'פרויקטים', 
      icon: 'projects',
      insights: [],
      subCategories: [
        { id: 'product-x', label: 'פרויקט אלפא', insights: [], subCategories: [] }
      ]
    },
    { 
      id: 'personal', 
      label: 'אישי', 
      icon: 'personal',
      insights: [],
      subCategories: [
        { id: 'habits', label: 'הרגלים יומיים', insights: [], subCategories: [] },
        { id: 'fitness', label: 'כושר ובריאות', insights: [], subCategories: [] }
      ]
    },
  ]
};

// --- Firestore Diagnostics ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  // If it's a permission error and email is not verified, give a hint
  if (errInfo.error.includes('Insufficient permissions') && errInfo.authInfo.emailVerified === false) {
    console.warn("LMM: Access denied because email is not verified. Please verify your Google account email.");
  }
  throw new Error(JSON.stringify(errInfo));
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'select'>('select');
  const [emailForm, setEmailForm] = useState({ email: '', password: '', name: '' });
  const [authLoading, setAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedRef = React.useRef(false);
  const lastSavedRef = React.useRef<string | null>(null);
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSubNavOpen, setIsSubNavOpen] = useState(false);
  
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'category'>('home');
  const [swipedInsightId, setSwipedInsightId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionsId, setActiveActionsId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Recursive Helpers ---
  const findCategoryById = (categories: Category[], id: string): Category | null => {
    if (!categories) return null;
    for (const cat of categories) {
      if (cat.id === id) return cat;
      const found = findCategoryById(cat.subCategories || [], id);
      if (found) return found;
    }
    return null;
  };

  const findCategoryPath = (categories: Category[], id: string, currentPath: Category[] = []): Category[] | null => {
    if (!categories) return null;
    for (const cat of categories) {
      const newPath = [...currentPath, cat];
      if (cat.id === id) return newPath;
      const found = findCategoryPath(cat.subCategories || [], id, newPath);
      if (found) return found;
    }
    return null;
  };

  const getParentId = (categories: Category[], targetId: string, parentId: string | null = null): string | null => {
    if (!categories) return null;
    for (const cat of categories) {
      if (cat.id === targetId) return parentId;
      const found = getParentId(cat.subCategories || [], targetId, cat.id);
      if (found) return found;
    }
    return null;
  };

  const countAllInsights = (cat: Category): number => {
    let count = cat.insights?.length || 0;
    if (cat.subCategories) {
      for (const sub of cat.subCategories) {
        count += countAllInsights(sub);
      }
    }
    return count;
  };

  const countAllCategories = (cats: Category[]): number => {
    if (!cats) return 0;
    let count = cats.length;
    for (const cat of cats) {
      count += countAllCategories(cat.subCategories || []);
    }
    return count;
  };

  const updateCategoryInTree = (categories: Category[], id: string, updater: (cat: Category) => Category): Category[] => {
    if (!categories) return [];
    return categories.map(cat => {
      if (cat.id === id) {
        return updater(cat);
      }
      return {
        ...cat,
        subCategories: updateCategoryInTree(cat.subCategories || [], id, updater)
      };
    });
  };

  const removeCategoryFromTree = (categories: Category[], id: string): Category[] => {
    if (!categories) return [];
    return categories.filter(c => c.id !== id).map(cat => ({
      ...cat,
      subCategories: removeCategoryFromTree(cat.subCategories || [], id)
    }));
  };

  // --- Main App Logic End ---

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
    console.log("Setting up auth listener...");
    
    // Check for guest session first
    const guestSession = sessionStorage.getItem('notebook_guest_session');
    const guestStartTime = sessionStorage.getItem('notebook_guest_start_time');
    
    if (guestSession === 'true' && guestStartTime) {
      const startTime = parseInt(guestStartTime);
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (now - startTime < thirtyMinutes) {
        console.log("Found active guest session");
        setIsGuest(true);
        // We don't set authLoading to false yet, let onAuthStateChanged run once
      } else {
        console.log("Guest session expired");
        sessionStorage.removeItem('notebook_guest_session');
        sessionStorage.removeItem('notebook_guest_start_time');
      }
    }

    // Safety timeout to prevent infinite "Checking connection"
    const timeoutId = setTimeout(() => {
      if (authLoading) {
        console.warn("Auth initialization taking longer than expected. Forcing loading to false.");
        setAuthLoading(false);
      }
    }, 8000);

    // Guest session expiration checker
    const sessionTimer = setInterval(() => {
      if (isGuest) {
        const guestStartTime = sessionStorage.getItem('notebook_guest_start_time');
        if (guestStartTime) {
          const startTime = parseInt(guestStartTime);
          const now = Date.now();
          const thirtyMinutes = 30 * 60 * 1000;
          if (now - startTime >= thirtyMinutes) {
            console.log("Guest session expired in real-time");
            handleLogout();
            alert("מצב אורח הסתיים לאחר 30 דקות. אנא התחבר כדי לשמור מידע לצמיתות.");
          }
        }
      }
    }, 60000); // Check every minute

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed, user:", u ? u.email : "none");
      clearTimeout(timeoutId);
      setUser(u);
      
      if (u) {
        setIsGuest(false);
        setIsDataLoading(true);
        // Clear guest signs as requested for smooth entry
        sessionStorage.removeItem('notebook_guest_session');
        sessionStorage.removeItem('notebook_guest_start_time');
      } else {
        if (!sessionStorage.getItem('notebook_guest_session')) {
          setData(DEFAULT_DATA);
          setIsGuest(false);
        }
        setIsDataLoading(false);
        hasLoadedRef.current = !sessionStorage.getItem('notebook_guest_session');
      }
      setAuthLoading(false);
    });

    // Test connection as per guidelines
    const checkConnection = async () => {
      try {
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
        console.log("Firestore connection verified");
      } catch (error: any) {
        if (error.message?.includes('offline')) {
          console.error("Firestore appears to be offline. Verify your configuration.");
        } else {
          console.log("Initial connection check failed or ignored, which is normal for some configs:", error.message);
        }
      }
    };
    checkConnection();

    return () => {
      unsubscribeAuth();
      clearTimeout(timeoutId);
      clearInterval(sessionTimer);
    };
  }, [isGuest]);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid, 'app', 'state');
    
    console.log("Starting data subscription for:", user.uid);
    setIsDataLoading(true);

    const unsubscribeSnapshot = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as AppData;
        const remoteStr = JSON.stringify(remoteData);
        
        // Only update local state if remote is actually different from what we have
        // to prevent cycles. Also update lastSavedRef to current remote data.
        if (remoteStr !== JSON.stringify(data)) {
          console.log("Cloud data found, updating local state.");
          setData(remoteData);
          lastSavedRef.current = remoteStr;
        }
      } else {
        console.log("No cloud data found for this user. Starting with defaults.");
        lastSavedRef.current = JSON.stringify(DEFAULT_DATA);
      }
      setIsDataLoading(false);
      hasLoadedRef.current = true;
    }, (err) => {
        handleFirestoreError(err, OperationType.GET, docRef.path);
        setIsDataLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // Remote update helper
  useEffect(() => {
    if (!user || isGuest || !hasLoadedRef.current || isDataLoading) return;
    
    const currentDataStr = JSON.stringify(data);
    // Don't save if it's the same as what we just loaded or saved
    if (currentDataStr === lastSavedRef.current) return;

    const docRef = doc(db, 'users', user.uid, 'app', 'state');
    
    const timeoutId = setTimeout(async () => {
        setIsSaving(true);
        try {
            // Save data and include email for tracking as requested by user
            await setDoc(docRef, {
                ...data,
                userEmail: user.email,
                lastUpdated: new Date().toISOString()
            });
            console.log("Data successfully synced to cloud.");
            lastSavedRef.current = currentDataStr;
        } catch (err) {
            console.error("Auto-sync error:", err);
            // Don't use handleFirestoreError here to avoid breaking user flow on every auto-save
        } finally {
            setIsSaving(false);
        }
    }, 1500); 

    return () => clearTimeout(timeoutId);
  }, [data, user, isDataLoading]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsightId, setEditingInsightId] = useState<string | null>(null);
  const [newInsight, setNewInsight] = useState<{ title: string; keepContent: string; improveContent: string; tags: string; categoryId: string }>({
    title: '',
    keepContent: '',
    improveContent: '',
    tags: '',
    categoryId: activeCategoryId
  });

  // Keep modal category in sync with active category when opening new
  useEffect(() => {
    if (!editingInsightId && isModalOpen) {
      setNewInsight(prev => ({ ...prev, categoryId: activeCategoryId }));
    }
  }, [activeCategoryId, isModalOpen, editingInsightId]);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [insightToMove, setInsightToMove] = useState<{id: string, catId: string} | null>(null);
  const [moveDestCatId, setMoveDestCatId] = useState('');


  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Derived state
  const activeCategory = useMemo(() => 
    findCategoryById(data.categories, activeCategoryId), 
    [data, activeCategoryId]
  );
  
  const activePath = useMemo(() => 
    findCategoryPath(data.categories, activeCategoryId) || [],
    [data, activeCategoryId]
  );

  const insightsCount = useMemo(() => 
    data.categories.reduce((total, cat) => total + countAllInsights(cat), 0), 
    [data]
  );
  
  const flatCategoriesList = useMemo(() => {
    const list: { id: string, label: string }[] = [];
    const traverse = (cats: Category[], prefix = '') => {
      if (!cats) return;
      cats.forEach(cat => {
        const fullLabel = prefix ? `${prefix} › ${cat.label}` : cat.label;
        list.push({ id: cat.id, label: fullLabel });
        traverse(cat.subCategories || [], fullLabel);
      });
    };
    traverse(data.categories);
    return list;
  }, [data.categories]);


  const openAddInsight = (catId?: string) => {
    setEditingInsightId(null);
    setNewInsight({ 
      title: '', 
      keepContent: '', 
      improveContent: '', 
      tags: '', 
      categoryId: catId || activeCategoryId || (data.categories.length > 0 ? data.categories[0].id : '')
    });
    setIsModalOpen(true);
  };

  const handleAnalyzeInsight = async () => {
    if (!newInsight.title.trim()) return;
    
    // Abort previous if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setIsAnalyzing(true);
    setAiAnalysis(null);

    // Scroll to section immediately
    setTimeout(() => {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      const rootCat = { id: 'root', label: 'כל התובנות', subCategories: data.categories, insights: [] };
      const allInsights = getAllInsightsInTree(rootCat as Category);
      
      const response = await fetch('/api/analyze-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          currentInsight: {
            title: newInsight.title,
            keepContent: newInsight.keepContent,
            improveContent: newInsight.improveContent
          },
          allInsights: allInsights.filter(i => i.title !== newInsight.title).slice(0, 50)
        })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      const result = await response.json();
      setAiAnalysis(result.analysis);
      
      // Scroll again when result arrives
      setTimeout(() => {
        aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setAiAnalysis("חלה שגיאה בניתוח התובנה. אנא נסה שוב.");
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleLogInsight = () => {
    if (!newInsight.title?.trim() || (!newInsight.keepContent?.trim() && !newInsight.improveContent?.trim())) return;
    const targetCatId = newInsight.categoryId || activeCategoryId;

    if (editingInsightId) {
      // If category changed, we need more complex logic (remove from old, add to new)
      // For now, let's assume we update in the current active category if not changed, 
      // but actually we should probably check if categoryId changed.
      
      setData(prev => {
        let categories = [...prev.categories];
        
        // Find existing insight to see if category changed
        let originalCatId = '';
        const findCat = (cats: Category[]): boolean => {
          for (const c of cats) {
            if (c.insights?.some(i => i.id === editingInsightId)) {
              originalCatId = c.id;
              return true;
            }
            if (findCat(c.subCategories || [])) return true;
          }
          return false;
        };
        findCat(prev.categories);

        if (originalCatId && originalCatId !== targetCatId) {
            // Move logic
            let movedInsight: Insight | null = null;
            categories = updateCategoryInTree(categories, originalCatId, (cat) => {
                const idx = cat.insights.findIndex(i => i.id === editingInsightId);
                const updatedInsights = [...cat.insights];
                if (idx !== -1) {
                  movedInsight = updatedInsights.splice(idx, 1)[0];
                }
                return { ...cat, insights: updatedInsights };
            });
            if (movedInsight) {
                const updatedMoved = {
                    ...movedInsight,
                    title: newInsight.title,
                    keepContent: newInsight.keepContent,
                    improveContent: newInsight.improveContent,
                    tags: newInsight.tags.split(',').map(t => t.trim()).filter(t => t !== '')
                };
                categories = updateCategoryInTree(categories, targetCatId, (cat) => ({
                    ...cat,
                    insights: [updatedMoved, ...(cat.insights || [])]
                }));
            }
        } else {
            categories = updateCategoryInTree(categories, targetCatId, (cat) => ({
                ...cat,
                insights: (cat.insights || []).map(i => i.id === editingInsightId ? {
                  ...i,
                  title: newInsight.title,
                  keepContent: newInsight.keepContent,
                  improveContent: newInsight.improveContent,
                  tags: newInsight.tags.split(',').map(t => t.trim()).filter(t => t !== '')
                } : i)
            }));
        }

        return { ...prev, categories };
      });
    } else {
      const entry: Insight = {
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: newInsight.title,
        keepContent: newInsight.keepContent,
        improveContent: newInsight.improveContent,
        createdAt: new Date().toLocaleDateString('he-IL'),
        tags: newInsight.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      };
      
      setData(prev => ({
        ...prev,
        categories: updateCategoryInTree(prev.categories, targetCatId, (cat) => ({
          ...cat,
          insights: [entry, ...(cat.insights || [])]
        }))
      }));
    }

    setNewInsight({ title: '', keepContent: '', improveContent: '', tags: '', categoryId: activeCategoryId });
    setEditingInsightId(null);
    setIsModalOpen(false);
    if (targetCatId !== activeCategoryId) {
        setActiveCategoryId(targetCatId);
    }
  };

  const startEdit = (insight: Insight, catId: string) => {
    setNewInsight({
      title: insight.title || '',
      keepContent: insight.keepContent || '',
      improveContent: insight.improveContent || '',
      tags: (insight.tags || []).join(', '),
      categoryId: catId
    });
    setEditingInsightId(insight.id);
    setIsModalOpen(true);
  };

  const renameCategory = (id: string) => {
    if (!editLabel.trim()) return;
    setData(prev => ({
      ...prev,
      categories: updateCategoryInTree(prev.categories, id, (cat) => ({
        ...cat,
        label: editLabel
      }))
    }));
    setEditingCategoryId(null);
    setEditLabel('');
  };

  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [newSubCategoryLabel, setNewSubCategoryLabel] = useState('');

  const [localIsAddingInMain, setLocalIsAddingInMain] = useState(false);
  const [newSubLabelMain, setNewSubLabelMain] = useState('');

  const handleAddSubCategory = () => {
    if (!newSubCategoryLabel.trim() || !activeCategoryId) return;
    
    const newCat: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: newSubCategoryLabel.trim(),
      insights: [],
      subCategories: []
    };

    const updateCategories = (list: Category[]): Category[] => {
      return list.map(cat => {
        if (cat.id === activeCategoryId) {
          return { ...cat, subCategories: [...(cat.subCategories || []), newCat] };
        }
        if (cat.subCategories && cat.subCategories.length > 0) {
          return { ...cat, subCategories: updateCategories(cat.subCategories) };
        }
        return cat;
      });
    };

    const updatedData = { ...data, categories: updateCategories(data.categories) };
    setData(updatedData);
    setNewSubCategoryLabel('');
    setIsSubCategoryModalOpen(false);
  };

  const getAllInsightsInTree = (cat: Category, path: string = ''): any[] => {
    let results: any[] = [];
    const currentPath = path ? `${path} › ${cat.label}` : cat.label;

    (cat.insights || []).forEach(insight => {
        results.push({
            category: currentPath,
            title: insight.title,
            keep: insight.keepContent,
            improve: insight.improveContent
        });
    });

    (cat.subCategories || []).forEach(sub => {
        results = [...results, ...getAllInsightsInTree(sub, currentPath)];
    });

    return results;
  };

  const exportToPDF = async () => {
    const rootCat = activeCategory || { id: 'root', label: 'כל התובנות', subCategories: data.categories, insights: [] };
    
    // Create a temporary hidden container for rendering the table
    const container = document.createElement('div');
    container.setAttribute('dir', 'rtl');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = 'white';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial, sans-serif'; 
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 24px; color: #1c1917; margin-bottom: 5px;">דוח תובנות - ${rootCat.label}</h1>
        <p style="font-size: 12px; color: #a8a29e;">יוצר בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e7e5e4;">
        <thead>
          <tr style="background-color: #f5f5f4;">
            <th style="border: 1px solid #e7e5e4; padding: 12px; text-align: right; font-size: 14px; width: 30%;">קטגוריה / תת-נושא</th>
            <th style="border: 1px solid #e7e5e4; padding: 12px; text-align: right; font-size: 14px; width: 35%;">שימור (מה עבד טוב)</th>
            <th style="border: 1px solid #e7e5e4; padding: 12px; text-align: right; font-size: 14px; width: 35%;">שיפור (מה ללמוד)</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
            const allInsights = getAllInsightsInTree(rootCat as Category);
            if (allInsights.length === 0) {
              return `<tr><td colspan="3" style="padding: 30px; text-align: center; color: #a8a29e;">אין תובנות להצגה תחת נושא זה</td></tr>`;
            }
            return allInsights.map(item => `
              <tr>
                <td style="border: 1px solid #e7e5e4; padding: 12px; vertical-align: top; font-size: 12px;">
                  <div style="font-weight: bold; margin-bottom: 4px;">${item.category}</div>
                  <div style="font-size: 11px; color: #78716c;">${item.title}</div>
                </td>
                <td style="border: 1px solid #e7e5e4; padding: 12px; vertical-align: top; font-size: 11px; color: #166534;">
                  ${item.keep || '-'}
                </td>
                <td style="border: 1px solid #e7e5e4; padding: 12px; vertical-align: top; font-size: 11px; color: #991b1b;">
                  ${item.improve || '-'}
                </td>
              </tr>
            `).join('');
          })()}
        </tbody>
      </table>
      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #a8a29e;">
        הופק באמצעות אפליקציית "הצמיחה שלי"
      </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`insights-${rootCat.label}-${new Date().toLocaleDateString('he-IL')}.pdf`);
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('חלה שגיאה בייצור ה-PDF. אנא נסה שוב.');
    } finally {
        document.body.removeChild(container);
    }
  };

  const handleAddMainCategory = () => {
    if (!newSubLabelMain.trim()) return;
    const newCat: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: newSubLabelMain.trim(),
        insights: [],
        subCategories: [],
        icon: 'personal'
    };
    setData(prev => ({
        ...prev,
        categories: [...prev.categories, newCat]
    }));
    setNewSubLabelMain('');
    setLocalIsAddingInMain(false);
    setActiveCategoryId(newCat.id);
    setCurrentView('category');
  };

  const deleteCategory = (id: string) => {
    console.log('Deleting category:', id);
    setData(prev => {
      const parentId = getParentId(prev.categories, id);
      const newCategories = removeCategoryFromTree(prev.categories, id);
      
      // Handle active category if it was the one deleted
      if (activeCategoryId === id) {
        if (parentId) {
          setActiveCategoryId(parentId);
        } else if (newCategories.length > 0) {
          setActiveCategoryId(newCategories[0].id);
        } else {
          setActiveCategoryId(''); 
          setCurrentView('home');
        }
      }
      
      return {
        ...prev,
        categories: newCategories
      };
    });
  };

  const removeInsight = (id: string, searchCatId?: string) => {
    if (searchCatId) {
      setData(prev => ({
        ...prev,
        categories: updateCategoryInTree(prev.categories, searchCatId, (cat) => ({
          ...cat,
          insights: (cat.insights || []).filter(i => i.id !== id)
        }))
      }));
    } else {
      // Search recursively everywhere
      const recursiveDeleteAction = (cats: Category[]): Category[] => {
        if (!cats) return [];
        return cats.map(cat => ({
          ...cat,
          insights: (cat.insights || []).filter(i => i.id !== id),
          subCategories: recursiveDeleteAction(cat.subCategories || [])
        }));
      };
      setData(prev => ({
        ...prev,
        categories: recursiveDeleteAction(prev.categories)
      }));
    }
  };

  const moveInsight = () => {
    if (!insightToMove || !moveDestCatId) return;
    
    setData(prev => {
      let movingInsight: Insight | null = null;
      
      // 1. Remove from source
      const removeAction = (cats: Category[]): Category[] => {
        if (!cats) return [];
        return cats.map(cat => {
            if (cat.id === insightToMove.catId) {
                const insights = cat.insights || [];
                const idx = insights.findIndex(i => i.id === insightToMove.id);
                if (idx !== -1) {
                    movingInsight = insights.splice(idx, 1)[0];
                }
                return { ...cat, insights: [...insights] };
            }
            return { ...cat, subCategories: removeAction(cat.subCategories || []) };
        });
      };
      
      let categories = removeAction(prev.categories);

      // 2. Add to destination
      if (movingInsight) {
        categories = updateCategoryInTree(categories, moveDestCatId, (cat) => ({
            ...cat,
            insights: [movingInsight!, ...(cat.insights || [])]
        }));
      }
      
      return { ...prev, categories };
    });
    
    setIsMoveModalOpen(false);
    setInsightToMove(null);
    setMoveDestCatId('');
  };

  // Breadcrumbs Helper
  const Breadcrumbs = () => (
    <nav className="flex items-center gap-1.5 text-stone-400 text-[10px] md:text-xs mb-4 md:mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <button 
        onClick={() => {
            setCurrentView('home');
            setIsMobileMenuOpen(false);
        }}
        className={`flex items-center gap-1 transition-colors ${currentView === 'home' ? 'text-stone-900 font-bold' : 'hover:text-stone-600'}`}
      >
        <Home size={12} />
        <span className="hidden sm:inline">הביתה</span>
      </button>
      {currentView === 'category' && activePath.map((node, index) => (
        <React.Fragment key={`${node.id}-${index}`}>
            <ChevronLeft size={10} className="shrink-0" />
            <button 
                onClick={() => setActiveCategoryId(node.id)}
                className={`hover:text-stone-600 ${index === activePath.length - 1 ? 'text-stone-900 font-bold' : ''}`}
            >
                {node.label}
            </button>
        </React.Fragment>
      ))}
    </nav>
  );

  // --- Home View Component ---
  const HomeView = () => {
    const allInsights = useMemo(() => {
      if (!data?.categories) return [];
      const insights: (Insight & { catLabel: string; catId: string })[] = [];
      
      const grabInsights = (cats: Category[]) => {
        if (!cats) return;
        cats.forEach(cat => {
            if (cat.insights) {
                cat.insights.forEach(insight => {
                    const insightTitle = insight.title || '';
                    const insightKeep = insight.keepContent || '';
                    const insightImprove = insight.improveContent || '';
                    const tagString = Array.isArray(insight.tags) ? insight.tags.join(' ') : (insight.tags || '');
                    
                    const matchesSearch = !searchTerm || 
                        insightTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        tagString.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        insightKeep.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        insightImprove.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    if (matchesSearch) {
                        insights.push({ ...insight, catLabel: cat.label, catId: cat.id });
                    }
                });
            }
            grabInsights(cat.subCategories || []);
        });
      };
      
      grabInsights(data.categories);
      return insights.sort((a, b) => {
          const dateA = a.createdAt.split('.').reverse().join('-');
          const dateB = b.createdAt.split('.').reverse().join('-');
          return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    }, [data, searchTerm]);

    const dailyInsight = useMemo(() => {
      // Use filtered allInsights for daily insight too if searching? 
      // Actually usually daily insight is fixed for the day.
      if (allInsights.length === 0) return null;
      const today = new Date().toDateString();
      const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return allInsights[seed % allInsights.length];
    }, [allInsights]);

    const stats = [
      { label: 'תחומים', count: data.categories.length, icon: <FolderOpen size={20} className="text-brand" /> },
      { label: 'תת-נושאים', count: countAllCategories(data.categories) - data.categories.length, icon: <Target size={20} className="text-brand" /> },
      { label: 'תובנות', count: insightsCount, icon: <Lightbulb size={20} className="text-brand" /> },
    ];

    const displayInsights = searchTerm ? allInsights : allInsights.slice(0, 3);

    return (
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 className="serif-title text-3xl md:text-4xl text-stone-900 leading-tight">בוקר טוב, מוכן לצמוח?</h2>
            <p className="text-stone-500 max-w-lg">לוח הבקרה שלך מרכז את כל מה שלמדת. הנה סקירה מהירה של מסע הלמידה שלך.</p>
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-6 py-3 bg-white text-stone-600 border border-stone-200 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition-all cursor-pointer shadow-sm md:mb-1"
          >
            <Download size={16} className="text-brand" />
            <span>ייצוא הכל ל-PDF</span>
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={`stat-${stat.label}-${i}`}
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
          <div className="lg:col-span-2 space-y-10">
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
                  <h3 className="serif-title text-2xl leading-relaxed text-right">{dailyInsight.title}</h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setActiveCategoryId(dailyInsight.catId);
                        setCurrentView('category');
                      }}
                      className="text-sm font-bold border-b border-white/40 hover:border-white transition-all pb-1"
                    >
                      קרא עוד בתוך <span className="text-right">{dailyInsight.catLabel}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="serif-title text-xl text-stone-900">{searchTerm ? 'תוצאות חיפוש' : 'תובנות אחרונות'}</h3>
                {allInsights.length > 3 && !searchTerm && <button className="text-sm text-brand font-bold hover:underline">ראה הכל</button>}
              </div>

              <div className="space-y-4">
                {(searchTerm ? allInsights : allInsights.slice(0, 3)).map((insight, i) => (
                  <motion.div 
                    key={`recent-insight-${insight.id}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => {
                        setActiveCategoryId(insight.catId);
                        setCurrentView('category');
                    }}
                    className="bg-white p-5 rounded-2xl border border-stone-100 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 shadow-sm transition-all cursor-pointer group flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:text-brand transition-colors shrink-0">
                        <Notebook size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-stone-800 truncate text-sm text-right">{insight.title}</div>
                        <div className="text-[9px] text-stone-400 font-bold uppercase tracking-widest truncate text-right">{insight.catLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                removeInsight(insight.id, insight.catId);
                            }}
                            className="p-2 text-stone-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                            <Minus size={16} />
                        </button>
                        <ChevronLeft size={16} className="text-stone-300 group-hover:text-brand transition-all shrink-0" />
                    </div>
                  </motion.div>
                ))}
                {allInsights.length === 0 && (
                  <div className="text-center py-12 bg-stone-50 rounded-3xl border border-dashed border-stone-200 w-full">
                    <Search size={32} className="mx-auto mb-4 opacity-10" />
                    <p className="text-stone-500 font-bold">{searchTerm ? 'לא נמצאו תוצאות לחיפוש שלך' : 'התחילו לכתוב ותראו כאן את התובנות האחרונות שלכם.'}</p>
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-4 text-brand text-xs font-bold underline">נקה חיפוש</button>}
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
                  ? Array.from(new Set(data.recentCategoryIds)).map(id => data.categories.find(c => c.id === id)).filter(Boolean) as Category[]
                  : data.categories.slice(0, 4)
                ).map((cat, i) => (
                  <button 
                    key={`access-${cat.id}-${i}`}
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setCurrentView('category');
                      trackCategoryVisit(cat.id);
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
          </div>
        </div>
      </div>
    );
  };

  // Combined Login Helper
  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      if (authMode === 'login') {
        await loginWithEmail(emailForm.email, emailForm.password);
      } else if (authMode === 'signup') {
        if (!emailForm.name.trim()) throw new Error("נא להזין שם מלא");
        await signUpWithEmail(emailForm.email, emailForm.password, emailForm.name);
      } else {
        await loginWithGoogle();
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let message = "תקלה בהתחברות: ";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "אימייל או סיסמה לא נכונים.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "כתובת האימייל הזו כבר רשומה במערכת.";
      } else if (error.code === 'auth/weak-password') {
        message = "הסיסמה חלשה מדי. השתמש ב-6 תווים לפחות.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "ההתחברות בוטלה.";
      } else {
        message += error.message || "נא לנסות שוב מאוחר יותר.";
      }
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestEntry = () => {
    console.log("Starting guest session...");
    sessionStorage.setItem('notebook_guest_session', 'true');
    sessionStorage.setItem('notebook_guest_start_time', Date.now().toString());
    setIsGuest(true);
    setData(DEFAULT_DATA);
    hasLoadedRef.current = true;
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('notebook_guest_session');
    sessionStorage.removeItem('notebook_guest_start_time');
    setIsGuest(false);
    if (user) {
      await signOut(auth);
    } else {
      setData(DEFAULT_DATA);
      setUser(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-notebook-cream flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <p className="text-stone-500 font-bold">בודק חיבור...</p>
            <p className="text-stone-400 text-sm">זה עשוי לקחת כמה שניות</p>
          </div>
          
          {/* Fallback button in case it really hangs */}
          <button 
            onClick={() => setAuthLoading(false)}
            className="text-stone-400 text-xs hover:text-brand transition-colors mt-4 underline decoration-dotted"
          >
            נתקעת? לחץ כאן למעבר למסך הכניסה
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-notebook-cream flex items-center justify-center p-6 text-right">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-stone-200 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-accent-soft rounded-[2rem] flex items-center justify-center mx-auto">
            <Notebook size={40} className="text-brand" />
          </div>
          <div className="space-y-2">
            <h1 className="serif-title text-4xl text-stone-900">מחברת הצמיחה</h1>
            <p className="text-stone-500 text-sm">התחבר כדי לשמור ולשתף את התובנות שלך.</p>
          </div>
          
          <div className="space-y-4">
            {authMode === 'select' ? (
              <div className="space-y-3">
                <button 
                  onClick={() => handleAuth()}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10 active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-stone-900 text-xs font-black">G</span>
                  </div>
                  התחברות עם Google
                </button>
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-stone-300 bg-white px-2">או</div>
                </div>

                <button 
                  onClick={() => setAuthMode('login')}
                  className="w-full py-4 rounded-2xl border-2 border-stone-100 text-stone-600 font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
                >
                  <User size={18} />
                  כניסה עם שם משתמש
                </button>

                <button 
                  onClick={handleGuestEntry}
                  className="w-full py-4 text-stone-400 text-sm font-medium hover:text-brand transition-colors"
                >
                  המשך כאורח (ללא שמירת נתונים)
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-3 text-right">
                {authMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">שם מלא</label>
                    <input 
                      type="text"
                      required
                      dir="rtl"
                      placeholder="ישראל ישראלי"
                      className="w-full p-4 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                      value={emailForm.name}
                      onChange={e => setEmailForm({...emailForm, name: e.target.value})}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">אימייל</label>
                  <input 
                    type="email"
                    required
                    dir="ltr"
                    placeholder="name@company.com"
                    className="w-full p-4 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand/20 transition-all text-left"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                    value={emailForm.email}
                    onChange={e => setEmailForm({...emailForm, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">סיסמה</label>
                  <input 
                    type="password"
                    required
                    dir="ltr"
                    placeholder="••••••••"
                    className="w-full p-4 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand/20 transition-all text-left"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                    value={emailForm.password}
                    onChange={e => setEmailForm({...emailForm, password: e.target.value})}
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-brand text-white py-4 rounded-2xl font-bold mt-4 hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 disabled:opacity-50"
                >
                  {isLoggingIn ? 'מעבד...' : authMode === 'login' ? 'התחברות' : 'יצירת חשבון'}
                </button>

                <div className="flex justify-between items-center px-2 pt-2">
                  <button 
                    type="button"
                    className="text-xs text-stone-400 hover:text-brand"
                    onClick={() => setAuthMode('select')}
                  >
                    חזרה
                  </button>
                  <button 
                    type="button"
                    className="text-xs text-brand font-bold"
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  >
                    {authMode === 'login' ? 'צריך חשבון? הרשמה' : 'יש לך חשבון? כניסה'}
                  </button>
                </div>
              </form>
            )}

            {loginError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-medium text-right border border-red-100"
              >
                {loginError}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-notebook-cream flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <p className="text-stone-500 font-bold">טוען את המידע שלך...</p>
            <p className="text-stone-400 text-sm">אנחנו מסנכרנים את התובנות שלך מהענן</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-notebook-cream font-sans selection:bg-stone-200 w-full overflow-hidden">

      
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
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (isSidebarOpen ? 280 : 80) : 280,
          x: isMobileMenuOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? '100%' : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed lg:relative flex flex-col h-full border-l border-stone-200 bg-notebook-paper shadow-sm z-50 right-0"
      >
        <div className="p-6 flex items-center justify-between">
          <motion.h1 
            animate={{ opacity: (isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) ? 1 : 0 }}
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

        <div className="px-6 mb-4 space-y-3">
            <div className="relative group">
                <Search className={`absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 transition-colors ${searchTerm ? 'text-brand' : ''}`} size={16} />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="חיפוש..."
                    dir="rtl"
                    className="w-full bg-stone-50 border border-transparent rounded-xl py-2.5 pr-10 pl-10 text-xs focus:ring-2 focus:ring-brand focus:bg-white transition-all outline-none"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-stone-300 hover:text-stone-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
            </div>
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
            {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>לוח בקרה</motion.span>}
          </button>

          <div className="space-y-1">
            {data.categories.map((cat, i) => (
              <SidebarItem 
                key={`${cat.id}-${i}`} 
                cat={cat} 
                depth={0}
                activeCategoryId={activeCategoryId}
                expandedIds={expandedIds}
                activeActionsId={activeActionsId}
                isSidebarOpen={isSidebarOpen}
                editingCategoryId={editingCategoryId}
                editLabel={editLabel}
                currentView={currentView}
                toggleExpanded={toggleExpanded}
                setActiveCategoryId={setActiveCategoryId}
                setCurrentView={setCurrentView}
                trackCategoryVisit={trackCategoryVisit}
                setActiveActionsId={setActiveActionsId}
                setEditingCategoryId={setEditingCategoryId}
                setEditLabel={setEditLabel}
                renameCategory={renameCategory}
                deleteCategory={deleteCategory}
                setData={setData}
                updateCategoryInTree={updateCategoryInTree}
              />
            ))}
          </div>

          {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
            <div className="pt-4 border-t border-stone-100">
              {localIsAddingInMain ? (
                <div className="flex gap-2 p-1.5 bg-white shadow-xl rounded-xl border border-stone-100">
                  <input 
                    autoFocus
                    type="text"
                    value={newSubLabelMain}
                    onChange={(e) => setNewSubLabelMain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMainCategory()}
                    onBlur={() => {
                        setTimeout(() => {
                            if (!newSubLabelMain) setLocalIsAddingInMain(false);
                        }, 200);
                    }}
                    placeholder="נושא ראשי חדש..."
                    dir="rtl"
                    className="w-full bg-stone-50 border border-transparent rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-brand focus:bg-white transition-all outline-none text-right"
                  />
                  <button 
                    onPointerDown={(e) => {
                        e.preventDefault();
                        handleAddMainCategory();
                    }} 
                    className="text-brand p-2 hover:scale-110 transition-transform shrink-0"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={() => {
                        setNewSubLabelMain('');
                        setLocalIsAddingInMain(false);
                    }} 
                    className="text-stone-300 hover:text-stone-500 p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setLocalIsAddingInMain(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 text-stone-400 group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                    <Plus size={18} />
                  </div>
                  <span className="font-bold text-xs">הוסף נושא חדש</span>
                </button>
              )}
            </div>
          )}
        </nav>

        {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 mt-auto border-t border-stone-100"
          >
             <div className="flex items-center justify-between gap-3 text-stone-400 text-[10px]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <Lightbulb size={12} className={insightsCount > 0 ? "text-yellow-400 fill-yellow-400" : ""} />
                        <span className="font-bold">{insightsCount}</span>
                    </div>
                    <button 
                        onClick={() => {
                            if (window.confirm('האם אתה בטוח שברצונך לאפס את כל המידע? פעולה זו אינה ניתנת לביטול.')) {
                                setData(DEFAULT_DATA);
                                setActiveCategoryId('work');
                                setCurrentView('home');
                                // Force an immediate save on reset
                                if (user) {
                                  const docRef = doc(db, 'users', user.uid, 'app', 'state');
                                  setDoc(docRef, { ...DEFAULT_DATA, userEmail: user.email, lastUpdated: new Date().toISOString() });
                                }
                            }
                        }}
                        className="hover:text-red-400 transition-colors cursor-pointer underline flex items-center gap-1"
                    >
                        <Trash2 size={10} />
                        <span>איפוס דאטה</span>
                    </button>
                </div>
                    <div className="flex flex-col gap-0.5 items-end overflow-hidden">
                        <span className="text-stone-500 font-medium truncate max-w-[120px] text-right" title={user?.email || 'אורח'}>
                            {isGuest ? 'מצב אורח' : (user?.displayName || user?.email)}
                        </span>
                        <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-stone-400 text-[8px] uppercase tracking-wider font-bold">
                                {isGuest ? 'לא נשמר בענן' : (isSaving ? 'מסנכרן...' : 'נשמר')}
                            </span>
                            <div className={`w-1.5 h-1.5 rounded-full ${isGuest ? 'bg-stone-300' : (isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400')}`}></div>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleLogout}
                    className="p-1.5 hover:bg-stone-50 rounded-lg transition-all group mt-3 flex items-center justify-center gap-2 border border-stone-100/50 w-full"
                    title="יציאה"
                >
                    <span className="text-[10px] font-bold text-stone-500 group-hover:text-stone-700">
                        {isGuest ? 'סיום מצב אורח' : 'התנתקות'}
                    </span>
                    <LogOut size={12} className="text-stone-400 group-hover:text-stone-600" />
                </button>
          </motion.div>
        )}
      </motion.aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0 w-full h-full">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-notebook-paper border-b border-stone-200 px-6 py-4 flex items-center justify-between shrink-0 w-full">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-stone-500 hover:text-stone-900 transition-colors">
            <Menu size={24} />
          </button>
          <h1 className="serif-title text-xl text-stone-800 tracking-tight">הצמיחה שלי</h1>
          <div className="w-10 h-10" /> 
        </header>

        {/* Sub-categories List (Now integrated into sidebar or home, but keep modal for mobile mobile menu) */}
        <AnimatePresence>
          {isSubNavOpen && (
            <motion.div 
              key="subnav-overlay"
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
                    <X size={20} onClick={() => setIsSubNavOpen(false)} className="cursor-pointer" />
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {(activeCategory?.subCategories || []).map((sub, i) => (
                      <div key={`subnav-${sub.id}-${i}`} className="flex gap-2">
                        <button 
                            onClick={() => {
                                setActiveCategoryId(sub.id);
                                setIsSubNavOpen(false);
                            }}
                            className={`flex-1 text-right p-4 rounded-2xl ${activeCategoryId === sub.id ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'}`}
                        >
                            {sub.label}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteCategory(sub.id);
                            }}
                            className="bg-red-50 text-red-500 p-4 rounded-2xl hover:bg-red-100 transition-colors"
                        >
                            <Minus size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="hidden lg:block"> {/* Spacer for desktop logic if needed, but SubNav is now in sidebar */}</div>

        {/* Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto bg-page-bg relative p-4 md:p-12 min-w-0 w-full">
          
          <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-2rem)] md:min-h-0">
            <Breadcrumbs />
            
            {currentView === 'home' || searchTerm ? (
                <HomeView />
            ) : (
                <>
                <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2">
                        <button 
                        onClick={() => setIsSubNavOpen(true)}
                        className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all cursor-pointer shadow-lg shadow-brand/20"
                        >
                            <Menu size={14} />
                            <span>נושאים</span>
                        </button>

                        <button 
                          onClick={exportToPDF}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-stone-600 border border-stone-200 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition-all cursor-pointer shadow-sm"
                        >
                          <Download size={14} className="text-brand" />
                          <span>ייצוא ל-PDF</span>
                        </button>
                    </div>
                    <h2 className="serif-title text-base md:text-xl text-stone-900 leading-tight text-right">
                    {activeCategory?.label}
                    </h2>
                    {activeCategory && activeCategory.subCategories && activeCategory.subCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {activeCategory.subCategories.map((sub, i) => (
                          <button 
                            key={`header-sub-${sub.id}-${i}`}
                            onClick={() => setActiveCategoryId(sub.id)}
                            className="bg-accent-soft/40 hover:bg-accent-soft px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 transition-colors"
                          >
                            <span className="text-right">{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openAddInsight(activeCategoryId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                  >
                    <Plus size={12} />
                    <span>תובנה חדשה</span>
                  </button>
                  <button 
                    onClick={() => setIsSubCategoryModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all shadow-sm"
                  >
                    <Plus size={12} />
                    <span>תת-נושא חדש</span>
                  </button>
                </div>
                </header>


                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-32 flex-1">
                <AnimatePresence mode="popLayout" initial={false}>
                    {(() => {
                      if (!activeCategory) return null;
                      
                      // Recursive insight gatherer for current view
                      const getInsightsRecursive = (cat: Category): Insight[] => {
                        let results = [...(cat.insights || [])];
                        if (cat.subCategories) {
                          cat.subCategories.forEach(sub => {
                            results = [...results, ...getInsightsRecursive(sub)];
                          });
                        }
                        return results;
                      };

                      const allViewInsights = getInsightsRecursive(activeCategory);
                      const filtered = allViewInsights.filter(i => {
                        if (!searchTerm) return true;
                        const s = searchTerm.toLowerCase();
                        const tagString = Array.isArray(i.tags) ? i.tags.join(' ') : (i.tags || '');
                        return (
                          (i.title || '').toLowerCase().includes(s) ||
                          tagString.toLowerCase().includes(s) ||
                          (i.keepContent || '').toLowerCase().includes(s) ||
                          (i.improveContent || '').toLowerCase().includes(s)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <motion.div 
                              key="no-insights-placeholder"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="col-span-full py-12 md:py-20 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-100 rounded-[2rem] flex-1 bg-white/30"
                          >
                              <motion.div 
                              animate={{ 
                                  rotate: [0, 5, -5, 0],
                                  scale: [1, 1.05, 1]
                              }}
                              transition={{ repeat: Infinity, duration: 4 }}
                              >
                              <FolderOpen size={48} className="mb-4 opacity-10" />
                              </motion.div>
                              <p className="text-xl serif-title text-stone-600">אין עדיין תובנות</p>
                              <p className="text-xs mt-1">זה הזמן להתחיל את מסע הצמיחה שלך.</p>
                              <button 
                              onClick={() => openAddInsight(activeCategoryId)}
                              className="mt-6 flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-full hover:bg-stone-800 hover:-translate-y-0.5 transition-all shadow-xl shadow-stone-900/10 text-xs font-bold"
                              >
                              <Plus size={16} />
                              תובנה ראשונה
                              </button>
                          </motion.div>
                        );
                      }

                      return filtered.map((insight, i) => (
                        <div key={`insight-grid-${insight.id}-${i}`} className="relative group overflow-hidden rounded-xl h-full min-h-[140px]">
                        {/* Action Buttons Background - Reveal on Swipe */}
                        <div className="absolute inset-0 bg-stone-50 rounded-xl flex items-center justify-end px-3 gap-2 z-0">
                            <button 
                                onClick={() => {
                                    removeInsight(insight.id, activeCategoryId);
                                    setSwipedInsightId(null);
                                }}
                                className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all text-[8px] font-bold flex-col gap-0.5"
                                title="מחיקה"
                            >
                                <Minus size={14} />
                                <span>מחק</span>
                            </button>
                            <button 
                                onClick={() => {
                                    setInsightToMove({ id: insight.id, catId: activeCategoryId });
                                    setIsMoveModalOpen(true);
                                    setSwipedInsightId(null);
                                }}
                                className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center hover:bg-stone-200 active:scale-95 transition-all text-[8px] font-bold flex-col gap-0.5"
                                title="העברה"
                            >
                                <Move size={14} />
                                <span>העבר</span>
                            </button>
                            <button 
                                onClick={() => {
                                    startEdit(insight, activeCategoryId);
                                    setSwipedInsightId(null);
                                }}
                                className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center hover:bg-brand/20 active:scale-95 transition-all text-[8px] font-bold flex-col gap-0.5"
                                title="עריכה"
                            >
                                <Pencil size={14} />
                                <span>ערוך</span>
                            </button>
                        </div>

                        <motion.div
                          layout
                          drag="x"
                          dragConstraints={{ left: 0, right: 140 }}
                          dragElastic={0}
                          onDragStart={() => setSwipedInsightId(insight.id)}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < 40) {
                                setSwipedInsightId(null);
                            }
                          }}
                          animate={{ 
                            x: swipedInsightId === insight.id ? 140 : 0,
                            opacity: 1,
                            y: 0,
                            scale: 1
                          }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          initial={{ opacity: 0, y: 15, scale: 0.98 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                          className="notebook-card p-3 flex flex-col gap-2 relative z-10 bg-white cursor-grab active:cursor-grabbing h-full"
                          onClick={() => {
                            if (swipedInsightId) setSwipedInsightId(null);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-stone-100/60 pb-1.5">
                            <h3 className="font-bold text-[11px] md:text-xs text-stone-900 leading-tight flex-1 line-clamp-1 text-right">{insight.title}</h3>
                            <div className="flex items-center gap-1 text-stone-300 text-[7px] font-bold tracking-widest whitespace-nowrap mt-0.5">
                              <Calendar size={7} />
                              {insight.createdAt}
                            </div>
                          </div>
                          
                          <div className="space-y-2 flex-1 overflow-hidden">
                            {insight.keepContent && (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded-full bg-keep-bg flex items-center justify-center">
                                    <CheckCircle2 size={7} className="text-keep-text" />
                                  </div>
                                  <span className="text-[7px] font-black text-keep-text uppercase tracking-widest">שימור</span>
                                </div>
                                <div 
                                  className="rich-content text-stone-600 text-[9px] leading-snug pr-2.5 border-r border-keep-text/20 line-clamp-2 text-right"
                                >
                                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(insight.keepContent) }} />
                                </div>
                              </div>
                            )}

                            {insight.improveContent && (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded-full bg-improve-bg flex items-center justify-center">
                                    <AlertCircle size={7} className="text-improve-text" />
                                  </div>
                                  <span className="text-[7px] font-black text-improve-text uppercase tracking-widest">צמיחה</span>
                                </div>
                                <div 
                                  className="rich-content text-stone-600 text-[9px] leading-snug pr-2.5 border-r border-improve-text/20 line-clamp-2 text-right"
                                >
                                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(insight.improveContent) }} />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-1.5 flex justify-between items-center mt-auto border-t border-stone-50">
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(insight, activeCategoryId);
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-stone-50 text-stone-400 hover:text-brand hover:bg-brand/5 rounded-md transition-all text-[9px] font-bold"
                              >
                                <Pencil size={10} />
                                <span>עריכה</span>
                              </button>
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeInsight(insight.id, activeCategoryId);
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-stone-50 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all text-[9px] font-bold"
                              >
                                <Minus size={10} />
                                <span>מחיקה</span>
                              </button>
                            </div>
                            <div className="text-[7px] font-bold text-stone-300 uppercase tracking-widest truncate max-w-[60px] text-left" dir="auto">
                                {insight.tags && (typeof insight.tags === 'string' ? insight.tags : insight.tags.join(', '))}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    ));
                  })()}
                </AnimatePresence>
                </section>
                </>
            )}
          </div>

          {/* Move Insight Modal */}
      <AnimatePresence>
        {isMoveModalOpen && (
          <div key="move-insight-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              key="move-insight-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoveModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="serif-title text-2xl text-stone-900">העברת תובנה</h3>
                <button onClick={() => setIsMoveModalOpen(false)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">בחר נושא יעד</label>
                    <select 
                        value={moveDestCatId} 
                        onChange={(e) => setMoveDestCatId(e.target.value)}
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-brand transition-all text-stone-800 font-bold"
                    >
                        <option value="">בחר נושא...</option>
                        {flatCategoriesList.map((item, i) => (
                            <option key={`move-option-${item.id}-${i}`} value={item.id}>{item.label}</option>
                        ))}
                    </select>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={moveInsight}
                  disabled={!moveDestCatId}
                  className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10 disabled:opacity-50"
                >
                  העבר עכשיו
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Mobile */}
          <button 
            onClick={() => openAddInsight()}
            className="lg:hidden fixed bottom-6 left-6 w-14 h-14 bg-brand text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand/40 active:scale-95 z-30 transition-transform"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Modals Container */}
      <AnimatePresence>
        {/* New Sub-Category Modal */}
        {isSubCategoryModalOpen && (
          <div key="new-subcategory-modal-overlay" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              key="new-subcategory-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubCategoryModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-xs relative overflow-hidden p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <FolderPlus size={16} className="text-brand" />
                  <h3 className="serif-title text-base text-stone-900 leading-tight">תת-נושא חדש</h3>
                </div>
                <button onClick={() => setIsSubCategoryModalOpen(false)} className="text-stone-300 hover:text-stone-900">
                  <X size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">שם התת-נושא</label>
                  <input 
                    autoFocus
                    type="text"
                    value={newSubCategoryLabel}
                    onChange={(e) => setNewSubCategoryLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubCategory()}
                    placeholder="לדוגמה: שלב מחקר, באגים..."
                    dir="rtl"
                    className="w-full bg-stone-50 border border-transparent rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand focus:bg-white transition-all outline-none text-right"
                  />
                </div>
                <button 
                  onClick={handleAddSubCategory}
                  disabled={!newSubCategoryLabel.trim()}
                  className="w-full py-3 bg-brand text-white rounded-xl font-bold text-xs hover:bg-opacity-90 transition-all shadow-lg shadow-brand/10 disabled:opacity-30 active:scale-95"
                >
                  הוסף תת-נושא
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Entry/Insight Modal */}
        {isModalOpen && (
          <div key="insight-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              key="insight-backdrop"
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
              className="bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-xl relative overflow-hidden mx-4"
            >
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="serif-title text-lg text-stone-900 leading-tight">
                    {editingInsightId ? 'עריכת תובנה' : 'תובנה חדשה'}
                  </h3>
                  <button 
                    onClick={() => {
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      setIsModalOpen(false);
                      setEditingInsightId(null);
                      setAiAnalysis(null);
                      setIsAnalyzing(false);
                      setNewInsight({ title: '', keepContent: '', improveContent: '', tags: '', categoryId: activeCategoryId });
                    }} 
                    className="text-stone-300 hover:text-stone-900 p-2 hover:bg-stone-50 rounded-full transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto pl-2 custom-scrollbar">
                  <div className="space-y-4">
                    <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 font-black uppercase tracking-widest">
                          <FolderOpen size={12} className="text-brand" />
                          מיקום בתיקיות:
                        </div>
                        <div className="text-[10px] text-stone-300 font-mono ltr">
                          {(findCategoryPath(data.categories, newInsight.categoryId || activeCategoryId) || []).map(c => c.label).join(' / ')}
                        </div>
                      </div>
                      <select 
                          value={newInsight.categoryId || activeCategoryId}
                          onChange={(e) => setNewInsight({ ...newInsight, categoryId: e.target.value })}
                          className="w-full p-2.5 bg-white rounded-xl border border-stone-200 focus:ring-2 focus:ring-brand/20 transition-all text-xs font-bold outline-none cursor-pointer"
                      >
                          {flatCategoriesList.map((item, i) => (
                              <option key={`insight-option-${item.id}-${i}`} value={item.id}>
                                {item.label}
                              </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest opacity-80">כותרת התובנה</label>
                            {!aiAnalysis && !isAnalyzing && newInsight.title.trim() && (
                              <button 
                                onClick={handleAnalyzeInsight}
                                className="text-[11px] font-bold text-brand hover:text-brand-dark transition-colors flex items-center gap-1.5 px-2 py-1 bg-brand/5 rounded-lg mb-1"
                              >
                                <Sparkles size={12} className="animate-pulse" />
                                חבר נקודות (AI)
                              </button>
                            )}
                        </div>
                        <div className="relative group">
                          <input 
                            autoFocus
                            type="text"
                            dir="rtl"
                            value={newInsight.title}
                            onChange={(e) => setNewInsight({ ...newInsight, title: e.target.value })}
                            placeholder="על מה נכתוב היום?"
                            className="w-full p-3 bg-stone-50 border-b-2 border-stone-200 focus:border-brand outline-none text-base text-stone-900 font-bold transition-all placeholder:text-stone-300 rounded-xl pr-4"
                          />
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[10px] font-black text-keep-text uppercase tracking-widest">
                          <CheckCircle2 size={14} />
                          מה עבד טוב? (חוזקות)
                        </div>
                      </div>
                      <div className="quill-wrapper shadow-sm rounded-xl overflow-hidden border border-stone-100 text-right" dir="rtl">
                        <ReactQuill 
                          theme="snow"
                          value={newInsight.keepContent}
                          onChange={(val) => setNewInsight(prev => ({ ...prev, keepContent: val }))}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="תיאור קצר של מה שכדאי לשמר..."
                          className="border-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[10px] font-black text-improve-text uppercase tracking-widest">
                          <AlertCircle size={14} />
                          מה ניתן לשפר? (צמיחה)
                        </div>
                      </div>
                      <div className="quill-wrapper shadow-sm rounded-xl overflow-hidden border border-stone-100 text-right" dir="rtl">
                        <ReactQuill 
                          theme="snow"
                          value={newInsight.improveContent}
                          onChange={(val) => setNewInsight(prev => ({ ...prev, improveContent: val }))}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="מה אפשר לעשות אחרת בפעם הבאה?..."
                          className="border-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-stone-400 mb-1.5 uppercase tracking-widest">תגיות</label>
                      <input 
                        type="text"
                        dir="rtl"
                        value={newInsight.tags}
                        onChange={(e) => setNewInsight({ ...newInsight, tags: e.target.value })}
                        placeholder="ניהול, מומנטום..."
                        className="w-full p-2.5 bg-stone-50 border border-transparent rounded-xl focus:bg-white focus:border-stone-200 outline-none text-[11px] font-medium"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleLogInsight}
                        disabled={!newInsight.title?.trim() || (!newInsight.keepContent?.trim() && !newInsight.improveContent?.trim())}
                        className="w-full sm:w-auto px-8 py-3 bg-brand text-white rounded-xl font-bold text-sm hover:translate-y-[-2px] transition-all shadow-lg shadow-brand/20 disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                      >
                        {editingInsightId ? 'עדכן תובנה' : 'שמור במחברת'}
                      </button>
                    </div>
                  </div>

                  {/* AI Analysis Section */}
                  {(aiAnalysis || isAnalyzing) && (
                    <div ref={aiSectionRef} className="mt-8 pt-6 border-t border-stone-200/50">
                      <div className="flex items-center gap-2.5 mb-4 text-[11px] font-black text-brand uppercase tracking-[0.1em] bg-brand/5 px-3 py-1.5 rounded-full w-fit ring-1 ring-brand/10">
                        <motion.div
                          animate={{ 
                            scale: [1, 1.3, 1],
                            rotate: [0, 15, -15, 0]
                          }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Sparkles size={14} className="text-brand" />
                        </motion.div>
                        תובנת AI: חיבור נקודות
                      </div>
                      
                      {isAnalyzing && (
                        <div className="bg-stone-50/50 p-8 rounded-3xl flex flex-col items-center justify-center gap-4 border border-dashed border-stone-200">
                          <div className="relative">
                            <motion.div 
                              className="absolute -inset-4 bg-brand/10 rounded-full blur-xl"
                              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            >
                              <BrainCircuit size={32} className="text-brand relative" />
                            </motion.div>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-stone-800">סורק את הזיכרון הדיגיטלי שלך...</span>
                            <span className="text-[11px] text-stone-400 font-medium">Gemini מחפש קשרים בין התובנות...</span>
                          </div>
                        </div>
                      )}

                      {aiAnalysis && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-brand/[0.02] border border-brand/10 p-6 rounded-3xl relative shadow-[0_8px_30px_rgb(0,0,0,0.02)] ring-1 ring-white"
                        >
                          <button 
                            onClick={() => {
                              if (abortControllerRef.current) {
                                abortControllerRef.current.abort();
                                abortControllerRef.current = null;
                              }
                              setAiAnalysis(null);
                              setIsAnalyzing(false);
                            }}
                            className="absolute top-4 left-4 text-stone-300 hover:text-brand transition-colors"
                          >
                            <X size={16} />
                          </button>
                          <div className="prose prose-stone prose-sm max-w-none prose-p:text-stone-700 prose-p:leading-relaxed prose-strong:text-brand prose-ul:my-2">
                            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
