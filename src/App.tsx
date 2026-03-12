import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  PenTool, 
  Lightbulb, 
  Plus, 
  Search, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Bold, 
  Italic, 
  Underline, 
  List, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Maximize2, 
  Minimize2, 
  Download, 
  Share2,
  Clock,
  Eye,
  History,
  Save,
  RotateCcw,
  X,
  BookmarkPlus,
  Upload,
  Sun,
  Moon,
  Loader2,
  Trash2,
  FileDown,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
  Tag as TagIcon,
  Check,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { jsPDF } from 'jspdf';
import { GoogleGenAI } from "@google/genai";

import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Set worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Types
type StoryType = 'Short Story' | 'Novel' | 'Idea';

interface Project {
  id: string;
  title: string;
  description: string;
  color: string;
  createdAt: number;
}

interface Story {
  id: string;
  projectId?: string; // Optional project ID
  title: string;
  type: StoryType;
  content: string;
  wordCount: number;
  wordCountGoal?: number;
  lastEdited: string;
  color: string;
  tags: string[]; // Array of tag IDs
}

interface Tag {
  id: string;
  label: string;
  color: string; // hex
  createdAt: number;
}

interface StoryVersion {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  wordCount: number;
}

// Mock Data
const initialStories: Story[] = [
  {
    id: '1',
    title: 'The Neon City',
    type: 'Novel',
    content: 'The rain fell in sheets, reflecting the neon signs of the city below. Cybernetic enhancements hummed softly in the damp air as Kael adjusted his collar. He had a job to do, and the target was somewhere in the underbelly of Sector 4.',
    wordCount: 12450,
    lastEdited: '2 hours ago',
    color: 'from-fuchsia-500 to-pink-500',
    tags: ['1', '2']
  },
  {
    id: '2',
    title: 'Echoes of the Past',
    type: 'Short Story',
    content: 'She found the old locket in the attic, covered in dust. As she opened it, a faint melody began to play, and memories she didn\'t know she had flooded her mind. It was a song from a time long forgotten, a time of magic and mystery.',
    wordCount: 3200,
    lastEdited: 'Yesterday',
    color: 'from-violet-500 to-purple-500',
    tags: ['3']
  },
  {
    id: '3',
    title: 'A World Without Sleep',
    type: 'Idea',
    content: 'What if humanity suddenly lost the need to sleep? How would society change? Would we achieve more, or would we go mad from the constant waking state? The protagonist is one of the few who still needs sleep, making them a target.',
    wordCount: 150,
    lastEdited: '3 days ago',
    color: 'from-amber-400 to-orange-500',
    tags: ['4']
  },
  {
    id: '4',
    title: 'The Clockwork King',
    type: 'Short Story',
    content: 'In a kingdom where everything was powered by gears and springs, the King was the most intricate machine of all. But his heart was failing, and the only one who could fix it was a young clockmaker from the slums.',
    wordCount: 4500,
    lastEdited: '1 week ago',
    color: 'from-emerald-400 to-teal-500',
    tags: ['1']
  }
];

const defaultTags: Tag[] = [
  { id: '1', label: 'Draft', color: '#94a3b8', createdAt: Date.now() },
  { id: '2', label: 'In Progress', color: '#38bdf8', createdAt: Date.now() },
  { id: '3', label: 'Final', color: '#10b981', createdAt: Date.now() },
  { id: '4', label: 'Character Notes', color: '#f472b6', createdAt: Date.now() },
  { id: '5', label: 'World Building', color: '#fbbf24', createdAt: Date.now() },
  { id: '6', label: 'Visual Prompt', color: '#818cf8', createdAt: Date.now() },
];

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor' | 'reader'>('dashboard');
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>(defaultTags);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Failed to log in.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setStories([]);
      setProjects([]);
      setTags(defaultTags);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const activeStoryIdRef = useRef(activeStoryId);
  useEffect(() => {
    activeStoryIdRef.current = activeStoryId;
  }, [activeStoryId]);

  // Load from Firestore
  useEffect(() => {
    if (!isAuthReady || !user) {
      setStories([]);
      setProjects([]);
      setTags(defaultTags);
      return;
    }

    const loadData = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Initialize user data
          await setDoc(userDocRef, {
            email: user.email,
            createdAt: Date.now()
          });
          
          // Initialize default tags
          const tagsRef = collection(db, `users/${user.uid}/tags`);
          for (const tag of defaultTags) {
            await setDoc(doc(tagsRef, tag.id), tag);
          }
        }

        // Listen to stories
        const storiesUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/stories`), (snapshot) => {
          const loadedStories = snapshot.docs.map(doc => doc.data() as Story);
          setStories(prevStories => {
            // Preserve local changes for the active story if it exists
            const currentActiveId = activeStoryIdRef.current;
            if (currentActiveId) {
              const localActiveStory = prevStories.find(s => s.id === currentActiveId);
              if (localActiveStory) {
                return loadedStories.map(s => s.id === currentActiveId ? localActiveStory : s);
              }
            }
            return loadedStories;
          });
        });

        // Listen to projects
        const projectsUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/projects`), (snapshot) => {
          const loadedProjects = snapshot.docs.map(doc => doc.data() as Project);
          setProjects(loadedProjects);
        });

        // Listen to tags
        const tagsUnsubscribe = onSnapshot(collection(db, `users/${user.uid}/tags`), (snapshot) => {
          const loadedTags = snapshot.docs.map(doc => doc.data() as Tag);
          if (loadedTags.length > 0) {
            setTags(loadedTags);
          }
        });

        return () => {
          storiesUnsubscribe();
          projectsUnsubscribe();
          tagsUnsubscribe();
        };
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, [user, isAuthReady]);

  // Save to Firestore (handled in specific functions now instead of generic useEffects)
  // Removed generic localStorage useEffects

  const activeStory = stories.find(s => s.id === activeStoryId);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const showLoading = (message: string, duration = 1500) => {
    setIsLoading(true);
    setLoadingMessage(message);
    return new Promise(resolve => setTimeout(() => {
      setIsLoading(false);
      resolve(true);
    }, duration));
  };

  const handleCreateStory = async (type: StoryType) => {
    if (!user) return;
    await showLoading(`Creating ${type}...`, 800);
    const newStory: Story = {
      id: Date.now().toString(),
      title: 'Untitled ' + type,
      type,
      content: '',
      wordCount: 0,
      lastEdited: 'Just now',
      color: type === 'Novel' ? 'from-fuchsia-500 to-pink-500' : 
             type === 'Short Story' ? 'from-violet-500 to-purple-500' : 
             'from-amber-400 to-orange-500',
      tags: []
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/stories`, newStory.id), newStory);
      setActiveStoryId(newStory.id);
      setView('editor');
    } catch (error) {
      console.error("Error creating story:", error);
      alert("Failed to create story.");
    }
  };

  const handleUpdateStory = async (id: string, updates: Partial<Story>) => {
    if (!user) return;
    try {
      const storyRef = doc(db, `users/${user.uid}/stories`, id);
      await setDoc(storyRef, updates, { merge: true });
    } catch (error) {
      console.error("Error updating story:", error);
    }
  };

  const processFileContent = async (file: File | Blob, fileName: string) => {
    if (!user) return;
    setIsLoading(true);
    setLoadingMessage(`Parsing ${fileName}...`);

    const extension = fileName.split('.').pop()?.toLowerCase();
    let content = '';

    try {
      if (extension === 'txt') {
        content = await (file instanceof File ? file.text() : new Response(file).text());
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (extension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        content = fullText;
      } else {
        setIsLoading(false);
        alert('Unsupported file type. Please upload .txt, .docx, or .pdf');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Extra beat for animation

      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const newStory: Story = {
        id: Date.now().toString(),
        title: fileName.replace(/\.[^/.]+$/, ""),
        type: wordCount > 5000 ? 'Novel' : 'Short Story',
        content,
        wordCount,
        lastEdited: 'Just now',
        color: wordCount > 5000 ? 'from-fuchsia-500 to-pink-500' : 'from-violet-500 to-purple-500',
        tags: []
      };

      await setDoc(doc(db, `users/${user.uid}/stories`, newStory.id), newStory);
      setActiveStoryId(newStory.id);
      setIsLoading(false);
      setView('editor');
    } catch (error) {
      console.error('Error parsing file:', error);
      setIsLoading(false);
      alert('Error parsing file. Please try again.');
    } finally {
      setLoadingMessage('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileContent(file, file.name);
  };

  const handleDeleteStory = async (id: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this story?')) return;
    try {
      const storyRef = doc(db, `users/${user.uid}/stories`, id);
      await deleteDoc(storyRef);
      if (activeStoryId === id) {
        setActiveStoryId(null);
        setView('dashboard');
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      alert("Failed to delete story.");
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans overflow-hidden`}>
      <input 
        type="file" 
        id="file-upload" 
        className="hidden" 
        accept=".txt,.docx,.pdf"
        onChange={handleFileUpload}
      />

      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-white"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="mb-4"
            >
              <Loader2 size={48} className="text-violet-500" />
            </motion.div>
            <p className="text-xl font-medium tracking-wide">{loadingMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isAuthReady ? (
          <div className="flex items-center justify-center h-screen">
            <Loader2 size={48} className="animate-spin text-violet-500" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center h-screen gap-6">
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
              Inkwell
            </h1>
            <p className="text-slate-500">Your creative sanctuary, synced to the cloud.</p>
            <button 
              onClick={handleLogin}
              className="px-8 py-4 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/30"
            >
              Sign in with Google
            </button>
          </div>
        ) : view === 'dashboard' && (
          <Dashboard 
            key="dashboard"
            user={user}
            onLogout={handleLogout}
            stories={stories} 
            projects={projects}
            setProjects={setProjects}
            tags={tags}
            setTags={setTags}
            theme={theme}
            toggleTheme={toggleTheme}
            onCreate={handleCreateStory}
            onDeleteStory={handleDeleteStory}
            onOpenEditor={(id: string) => { setActiveStoryId(id); setView('editor'); }}
            onOpenReader={(id: string) => { setActiveStoryId(id); setView('reader'); }}
            onUpdateStory={handleUpdateStory}
          />
        )}
        {view === 'editor' && activeStory && user && (
          <Editor 
            key="editor"
            user={user}
            story={activeStory}
            stories={stories}
            tags={tags}
            theme={theme}
            toggleTheme={toggleTheme}
            onUpdate={(updates: Partial<Story>) => handleUpdateStory(activeStory.id, updates)}
            onBack={() => setView('dashboard')}
            isFocusMode={isFocusMode}
            setIsFocusMode={setIsFocusMode}
            showLoading={showLoading}
          />
        )}
        {view === 'reader' && activeStory && user && (
          <Reader 
            key="reader"
            story={activeStory}
            theme={theme}
            onBack={() => setView('dashboard')}
            onEdit={() => setView('editor')}
            showLoading={showLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Dashboard({ user, onLogout, stories, projects, setProjects, tags, setTags, onCreate, onDeleteStory, onOpenEditor, onOpenReader, theme, toggleTheme, onUpdateStory }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'AND' | 'OR'>('OR');
  const [selectedTypes, setSelectedTypes] = useState<StoryType[]>([]);
  const [wordCountRange, setWordCountRange] = useState<{ min: number, max: number }>({ min: 0, max: 100000 });
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showTagManager, setShowTagManager] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);

  const totalWords = stories.reduce((acc: number, s: any) => acc + s.wordCount, 0);
  const novelsCount = stories.filter((s: any) => s.type === 'Novel').length;
  const shortStoriesCount = stories.filter((s: any) => s.type === 'Short Story').length;
  const ideasCount = stories.filter((s: any) => s.type === 'Idea').length;

  const filteredStories = stories.filter((story: any) => {
    const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         story.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProject = activeProjectId ? story.projectId === activeProjectId : true;
    
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(story.type);
    
    const matchesWordCount = story.wordCount >= wordCountRange.min && story.wordCount <= wordCountRange.max;
    
    let matchesDate = true;
    if (dateRange !== 'all') {
      const storyDate = new Date(story.lastEdited).getTime();
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      if (dateRange === 'today') matchesDate = now - storyDate < day;
      else if (dateRange === 'week') matchesDate = now - storyDate < 7 * day;
      else if (dateRange === 'month') matchesDate = now - storyDate < 30 * day;
    }

    const storyTags = story.tags || [];
    const matchesTags = selectedTags.length === 0 || (tagFilterMode === 'OR' 
      ? selectedTags.some(tagId => storyTags.includes(tagId))
      : selectedTags.every(tagId => storyTags.includes(tagId)));

    return matchesSearch && matchesTags && matchesProject && matchesType && matchesWordCount && matchesDate;
  });

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim() || !user) return;
    const newProject: Project = {
      id: Date.now().toString(),
      title: newProjectTitle.trim(),
      description: '',
      color: 'from-indigo-500 to-blue-600',
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, `users/${user.uid}/projects`, newProject.id), newProject);
      setNewProjectTitle('');
      setShowNewProjectModal(false);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project.");
    }
  };

  const activeProject = projects.find((p: any) => p.id === activeProjectId);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleStorySelection = (id: string) => {
    setSelectedStoryIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedStoryIds.length} stories?`)) {
      selectedStoryIds.forEach(id => onDeleteStory(id));
      setIsBatchMode(false);
      setSelectedStoryIds([]);
    }
  };

  const handleBatchExport = (format: 'pdf' | 'md' | 'txt') => {
    const selectedStories = stories.filter((s: any) => selectedStoryIds.includes(s.id));
    selectedStories.forEach((story: any) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = story.content;
      const plainText = tempDiv.innerText || tempDiv.textContent || '';

      if (format === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text(story.title, 20, 20);
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(plainText, 170);
        doc.text(splitText, 20, 30);
        doc.save(`${story.title}.pdf`);
      } else if (format === 'md') {
        const blob = new Blob([`# ${story.title}\n\n${plainText}`], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${story.title}.md`;
        a.click();
      } else {
        const blob = new Blob([`${story.title}\n\n${plainText}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${story.title}.txt`;
        a.click();
      }
    });
    setIsBatchMode(false);
    setSelectedStoryIds([]);
    setShowExportModal(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto p-6 md:p-10 h-screen overflow-y-auto"
    >
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
            Inkwell
          </h1>
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mt-1 font-medium`}>Your creative sanctuary</p>
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={onLogout}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Sign Out
          </button>
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          <label htmlFor="file-upload" className={`p-2 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title="Upload File">
            <Upload size={20} />
          </label>
          <button onClick={() => onCreate('Idea')} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`} title="New Idea">
            <Lightbulb size={20} />
          </button>
          <button onClick={() => onCreate('Short Story')} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-violet-900/30 text-violet-400 hover:bg-violet-900/50' : 'bg-violet-100 text-violet-600 hover:bg-violet-200'}`} title="New Short Story">
            <PenTool size={20} />
          </button>
          <button onClick={() => onCreate('Novel')} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold hover:shadow-lg hover:shadow-fuchsia-500/30 transition-all">
            <Plus size={20} />
            <span className="hidden sm:inline">New Novel</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard icon={<FileText />} label="Total Words" value={totalWords.toLocaleString()} color={theme === 'dark' ? "bg-blue-900/20 text-blue-400" : "bg-blue-50 text-blue-600"} theme={theme} />
        <StatCard icon={<BookOpen />} label="Novels" value={novelsCount} color={theme === 'dark' ? "bg-fuchsia-900/20 text-fuchsia-400" : "bg-fuchsia-50 text-fuchsia-600"} theme={theme} />
        <StatCard icon={<PenTool />} label="Short Stories" value={shortStoriesCount} color={theme === 'dark' ? "bg-violet-900/20 text-violet-400" : "bg-violet-50 text-violet-600"} theme={theme} />
        <StatCard icon={<Lightbulb />} label="Ideas" value={ideasCount} color={theme === 'dark' ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-600"} theme={theme} />
      </div>

      {/* Projects Section */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Projects</h2>
          <button 
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-500 transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <button 
            onClick={() => setActiveProjectId(null)}
            className={`flex-shrink-0 px-6 py-4 rounded-2xl border-2 transition-all flex flex-col justify-center items-center gap-1 min-w-[120px] ${!activeProjectId ? 'border-violet-500 bg-violet-500/10 text-violet-600' : theme === 'dark' ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-100 bg-white text-slate-500'}`}
          >
            <span className="text-lg font-bold">All</span>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Stories</span>
          </button>
          {projects.map((project: any) => {
            const projectStories = stories.filter((s: any) => s.projectId === project.id);
            const projectWords = projectStories.reduce((acc: number, s: any) => acc + s.wordCount, 0);
            return (
              <button 
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={`flex-shrink-0 px-6 py-4 rounded-2xl border-2 transition-all flex flex-col gap-1 min-w-[160px] text-left relative overflow-hidden ${activeProjectId === project.id ? 'border-violet-500 bg-violet-500/10 text-violet-600' : theme === 'dark' ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-100 bg-white text-slate-500'}`}
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${project.color}`}></div>
                <span className="text-lg font-bold line-clamp-1">{project.title}</span>
                <span className="text-[10px] uppercase tracking-widest opacity-60">{projectStories.length} scenes • {projectWords.toLocaleString()} words</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Advanced Filters */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search stories, ideas, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedStoryIds([]);
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border transition-all font-bold text-sm ${isBatchMode ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/20' : theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-sm'}`}
            >
              <FileText size={18} />
              {isBatchMode ? 'Cancel Batch' : 'Batch Export'}
            </button>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border transition-all font-bold text-sm ${showAdvancedFilters ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-amber-500/20' : theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-sm'}`}
            >
              <SettingsIcon size={18} />
              Filters
            </button>
            <button 
              onClick={() => setShowTagManager(true)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border transition-all font-bold text-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-sm'}`}
            >
              <TagIcon size={18} />
              Tags
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`overflow-hidden rounded-3xl border mb-8 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
            >
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-4 block tracking-widest">Story Type</label>
                    <div className="flex flex-wrap gap-2">
                      {(['Novel', 'Short Story', 'Idea'] as StoryType[]).map(type => (
                        <button 
                          key={type}
                          onClick={() => setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTypes.includes(type) ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-4 block tracking-widest">Date Modified</label>
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'today', 'week', 'month'] as const).map(range => (
                        <button 
                          key={range}
                          onClick={() => setDateRange(range)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${dateRange === range ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-4 block tracking-widest">Word Count Range</label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          placeholder="Min"
                          value={wordCountRange.min}
                          onChange={(e) => setWordCountRange({ ...wordCountRange, min: parseInt(e.target.value) || 0 })}
                          className={`w-full px-4 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                      </div>
                      <span className="text-slate-400 font-bold">to</span>
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          placeholder="Max"
                          value={wordCountRange.max}
                          onChange={(e) => setWordCountRange({ ...wordCountRange, max: parseInt(e.target.value) || 100000 })}
                          className={`w-full px-4 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-widest">Filter by Tags</label>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Match Mode:</span>
                      <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1">
                        <button 
                          onClick={() => setTagFilterMode('OR')}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${tagFilterMode === 'OR' ? 'bg-white dark:bg-slate-700 text-violet-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          OR
                        </button>
                        <button 
                          onClick={() => setTagFilterMode('AND')}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${tagFilterMode === 'AND' ? 'bg-white dark:bg-slate-700 text-violet-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          AND
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: any) => (
                      <button 
                        key={tag.id}
                        onClick={() => toggleTagFilter(tag.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTags.includes(tag.id) ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.label}
                      </button>
                    ))}
                    {selectedTags.length > 0 && (
                      <button 
                        onClick={() => setSelectedTags([])}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors"
                      >
                        Clear Tags
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent Stories */}
      <div>
        <div className="flex justify-between items-center mb-8">
          <h2 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
            {selectedTags.length > 0 || selectedTypes.length > 0 || dateRange !== 'all' || searchQuery ? 'Filtered Stories' : 'Recent Stories'}
          </h2>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <span>{filteredStories.length} items found</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {filteredStories.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-slate-500 text-lg">No stories found matching your criteria.</p>
              <button onClick={() => { setSearchQuery(''); setSelectedTags([]); }} className="text-violet-600 font-bold mt-2 hover:underline">Clear all filters</button>
            </div>
          ) : (
            filteredStories.map((story: any) => (
              <motion.div 
                key={story.id}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`rounded-2xl p-6 shadow-sm border transition-all group cursor-pointer flex flex-col h-72 relative overflow-hidden ${isBatchMode && selectedStoryIds.includes(story.id) ? 'border-violet-500 ring-2 ring-violet-500' : theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:shadow-violet-500/10' : 'bg-white border-slate-100 hover:shadow-xl'}`}
                onClick={() => isBatchMode ? toggleStorySelection(story.id) : onOpenEditor(story.id)}
              >
                {isBatchMode && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedStoryIds.includes(story.id) ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 bg-white/50'}`}>
                      {selectedStoryIds.includes(story.id) && <Check size={14} />}
                    </div>
                  </div>
                )}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${story.color}`}></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r w-fit ${story.color}`}>
                      {story.type}
                    </span>
                    {story.projectId && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {projects.find((p: any) => p.id === story.projectId)?.title}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <select 
                      className={`text-[10px] bg-transparent border-none focus:ring-0 cursor-pointer ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}
                      value={story.projectId || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateStory(story.id, { projectId: e.target.value || undefined });
                      }}
                    >
                      <option value="">No Project</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <button 
                      className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                      onClick={(e) => { e.stopPropagation(); onOpenReader(story.id); }}
                      title="Read PDF Render"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'}`}
                      onClick={(e) => { e.stopPropagation(); onDeleteStory(story.id); }}
                      title="Delete Story"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className={`text-xl font-bold mb-2 line-clamp-1 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{story.title}</h3>
                <p className={`text-sm line-clamp-2 mb-4 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {story.content ? story.content.replace(/<[^>]*>?/gm, '') : "No content yet. Start writing..."}
                </p>

                <div className="mt-auto flex flex-wrap gap-1.5">
                  {story.tags?.map((tagId: string) => {
                    const tag = tags.find((t: any) => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span 
                        key={tagId} 
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.label}
                      </span>
                    );
                  })}
                </div>

                <div className={`flex items-center justify-between mt-4 pt-4 border-t text-xs font-medium ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-50 text-slate-400'}`}>
                  <div className="flex items-center gap-1">
                    <FileText size={14} />
                    <span>{story.wordCount.toLocaleString()} words</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>{story.lastEdited}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <TagManager 
        isOpen={showTagManager} 
        onClose={() => setShowTagManager(false)} 
        tags={tags} 
        setTags={setTags} 
        theme={theme} 
        stories={stories}
        onUpdateStory={onUpdateStory}
      />

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
            >
              <h3 className="text-xl font-bold mb-6">Create New Project</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Project Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cyberpunk Novel"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowNewProjectModal(false)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-colors ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProject}
                  className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-colors"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Batch Actions */}
      <AnimatePresence>
        {isBatchMode && selectedStoryIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-8 py-4 rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800"
          >
            <span className="text-sm font-bold">{selectedStoryIds.length} stories selected</span>
            <div className="w-px h-6 bg-slate-700 mx-2"></div>
            <button 
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors font-bold text-sm"
            >
              <Download size={18} />
              Export Selected
            </button>
            <button 
              onClick={handleBatchDelete}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 transition-colors font-bold text-sm"
            >
              <Trash2 size={18} />
              Delete Selected
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <h3 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Export Batch</h3>
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => handleBatchExport('pdf')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all hover:border-violet-500 hover:bg-violet-500/5 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
                      <FileText size={24} />
                    </div>
                    <div className="text-left">
                      <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>PDF Document</div>
                      <div className="text-xs text-slate-500 font-medium">Best for printing and sharing</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400" />
                </button>
                <button 
                  onClick={() => handleBatchExport('md')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all hover:border-violet-500 hover:bg-violet-500/5 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                      <FileText size={24} />
                    </div>
                    <div className="text-left">
                      <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Markdown</div>
                      <div className="text-xs text-slate-500 font-medium">Best for web and other editors</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400" />
                </button>
                <button 
                  onClick={() => handleBatchExport('txt')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all hover:border-violet-500 hover:bg-violet-500/5 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
                      <FileText size={24} />
                    </div>
                    <div className="text-left">
                      <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Plain Text</div>
                      <div className="text-xs text-slate-500 font-medium">Simple and universal</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400" />
                </button>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className={`w-full mt-8 py-4 rounded-2xl font-bold text-sm transition-colors ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TagManager({ isOpen, onClose, tags, setTags, theme, stories, onUpdateStory }: any) {
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const colors = [
    '#6366f1', '#ec4899', '#f43f5e', '#f59e0b', 
    '#10b981', '#06b6d4', '#8b5cf6', '#64748b'
  ];

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (!newTagLabel.trim()) return;
    const newTag: Tag = {
      id: Date.now().toString(),
      label: newTagLabel.trim(),
      color: newTagColor,
      createdAt: Date.now()
    };
    setTags([...tags, newTag]);
    setNewTagLabel('');
  };

  const handleDeleteTag = (tagId: string) => {
    if (confirm('Are you sure you want to delete this tag? It will be removed from all documents.')) {
      setTags(tags.filter((t: any) => t.id !== tagId));
      // Remove tag from all stories
      stories.forEach((story: any) => {
        if (story.tags?.includes(tagId)) {
          onUpdateStory(story.id, { tags: story.tags.filter((id: string) => id !== tagId) });
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Search size={20} className="text-violet-500" />
            Manage Tags
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-500">Create New Tag</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Tag name..."
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                className={`flex-1 px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              />
              <button 
                onClick={handleAddTag}
                className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => (
                <button 
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${newTagColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-500">Existing Tags</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {tags.map((tag: any) => (
                <div key={tag.id} className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="font-medium">{tag.label}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteTag(tag.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-950">
          <button 
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, color, theme }: any) {
  return (
    <div className={`p-5 rounded-2xl shadow-sm border flex items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
        <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}

function Editor({ user, story, stories, tags, onUpdate, onBack, isFocusMode, setIsFocusMode, theme, toggleTheme, showLoading }: any) {
  const editorRef = useRef<HTMLDivElement>(null);
  const focusEditorRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<StoryVersion[]>([]);
  const [previewVersion, setPreviewVersion] = useState<StoryVersion | null>(null);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportVersion, setExportVersion] = useState<StoryVersion | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [sessionStartWordCount] = useState(story.wordCount);
  const [showStats, setShowStats] = useState(true);
  const [isSplitPane, setIsSplitPane] = useState(false);
  const [secondStoryId, setSecondStoryId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedTextForComment, setSelectedTextForComment] = useState('');

  useEffect(() => {
    if (!user) return;
    const commentsRef = collection(db, `users/${user.uid}/stories/${story.id}/comments`);
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const loadedComments = snapshot.docs.map(doc => doc.data() as any).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setComments(loadedComments);
    });
    return () => unsubscribe();
  }, [story.id, user]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    const comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      author: user.displayName || user.email || 'You',
      timestamp: Date.now(),
      quotedText: selectedTextForComment
    };
    try {
      await setDoc(doc(db, `users/${user.uid}/stories/${story.id}/comments`, comment.id), comment);
      setNewComment('');
      setSelectedTextForComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/stories/${story.id}/comments`, commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedTextForComment(selection.toString().trim());
    }
  };

  const handleAIAction = async (action: 'continue' | 'rewrite' | 'ideas') => {
    setAiLoading(true);
    setAiResponse('');
    
    let prompt = '';
    if (action === 'continue') {
      prompt = `Continue writing this story. Context: ${story.content.slice(-1000)}`;
    } else if (action === 'rewrite') {
      prompt = `Rewrite the following text to be more descriptive and engaging: ${selectedTextForComment || story.content.slice(-500)}`;
    } else if (action === 'ideas') {
      prompt = `Generate 5 creative plot ideas or twists for a story with this title: ${story.title}. Current content: ${story.content.slice(0, 500)}`;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiResponse(response.text || 'No response from AI.');
    } catch (error) {
      console.error(error);
      setAiResponse('Error generating content. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const insertAIResponse = () => {
    const newContent = story.content + `<br><br><div>${aiResponse}</div>`;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newContent;
    const wordCount = (tempDiv.innerText || '').trim().split(/\s+/).length;
    
    onUpdate({ content: newContent, wordCount });
    setAiResponse('');
    setShowAIAssistant(false);
  };

  const secondStory = stories.find((s: any) => s.id === secondStoryId);
  const sessionWords = Math.max(0, story.wordCount - sessionStartWordCount);
  const progress = story.wordCountGoal ? Math.min(100, (story.wordCount / story.wordCountGoal) * 100) : 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExportModal(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowTagPicker(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    const versionsRef = collection(db, `users/${user.uid}/stories/${story.id}/versions`);
    const unsubscribe = onSnapshot(versionsRef, (snapshot) => {
      const loadedVersions = snapshot.docs.map(doc => doc.data() as StoryVersion).sort((a, b) => b.timestamp - a.timestamp);
      setVersions(loadedVersions);
    });
    return () => unsubscribe();
  }, [story.id, user]);

  const storyRef = useRef(story);
  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  // Autosave logic
  useEffect(() => {
    const autosaveInterval = setInterval(() => {
      const currentStory = storyRef.current;
      if (!user) return;
      setDoc(doc(db, `users/${user.uid}/stories`, currentStory.id), {
        title: currentStory.title,
        content: currentStory.content,
        wordCount: currentStory.wordCount,
        lastEdited: 'Just now'
      }, { merge: true }).then(() => {
        console.log(`Autosaved story ${currentStory.id} at ${new Date().toLocaleTimeString()}`);
      }).catch(error => {
        console.error("Error autosaving:", error);
      });
    }, 30000); // 30 seconds

    return () => {
      clearInterval(autosaveInterval);
      const currentStory = storyRef.current;
      if (user) {
        setDoc(doc(db, `users/${user.uid}/stories`, currentStory.id), {
          title: currentStory.title,
          content: currentStory.content,
          wordCount: currentStory.wordCount,
          lastEdited: 'Just now'
        }, { merge: true }).catch(error => {
          console.error("Error autosaving on unmount:", error);
        });
      }
    };
  }, [story.id, user]);

  const saveVersion = async () => {
    if (!user) return;
    await showLoading('Saving version...', 600);
    const newVersion: StoryVersion = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title: story.title,
      content: story.content,
      wordCount: story.wordCount
    };
    try {
      await setDoc(doc(db, `users/${user.uid}/stories/${story.id}/versions`, newVersion.id), newVersion);
      setVersions([newVersion, ...versions]);
    } catch (error) {
      console.error("Error saving version:", error);
      alert("Failed to save version.");
    }
  };

  const saveDraft = async () => {
    if (!user) return;
    await showLoading('Saving draft...', 500);
    try {
      await setDoc(doc(db, `users/${user.uid}/stories`, story.id), {
        title: story.title,
        content: story.content,
        wordCount: story.wordCount,
        lastEdited: 'Just now'
      }, { merge: true });
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const handleRestore = async (version: StoryVersion) => {
    await showLoading('Restoring version...', 800);
    onUpdate({
      title: version.title,
      content: version.content,
      wordCount: version.wordCount,
      lastEdited: 'Restored from history'
    });
    setPreviewVersion(null);
    setShowHistory(false);
  };

  const lastSentContent = useRef(story.content);

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    const activeRef = isFocusMode ? focusEditorRef.current : editorRef.current;
    if (activeRef) {
      activeRef.focus();
      handleContentChange();
    }
  };

  const handleContentChange = () => {
    const activeRef = isFocusMode ? focusEditorRef.current : editorRef.current;
    if (!activeRef) return;
    const content = activeRef.innerHTML;
    lastSentContent.current = content;
    const textContent = activeRef.innerText || '';
    const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
    onUpdate({ content, wordCount, lastEdited: 'Just now' });
  };

  const displayTitle = previewVersion ? previewVersion.title : story.title;
  const displayContent = previewVersion ? previewVersion.content : story.content;

  useEffect(() => {
    const activeRef = isFocusMode ? focusEditorRef.current : editorRef.current;
    if (activeRef && displayContent !== lastSentContent.current) {
      if (activeRef.innerHTML !== displayContent) {
        activeRef.innerHTML = displayContent || '';
        lastSentContent.current = displayContent || '';
      }
    }
  }, [displayContent, isFocusMode]);

  if (isFocusMode) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-50 overflow-y-auto flex justify-center transition-colors duration-700 ${theme === 'dark' ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}`}
      >
        <button 
          onClick={() => setIsFocusMode(false)}
          className={`fixed top-6 right-6 p-3 rounded-full transition-all opacity-50 hover:opacity-100 focus:opacity-100 group ${theme === 'dark' ? 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          <Minimize2 size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Exit Focus</span>
        </button>
        
        <div className="w-full max-w-3xl px-8 py-24">
          <input
            type="text"
            value={displayTitle}
            onChange={(e) => onUpdate({ title: e.target.value })}
            readOnly={!!previewVersion}
            className={`w-full bg-transparent text-4xl font-serif font-bold mb-8 focus:outline-none placeholder-slate-700 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}
            placeholder="Story Title"
          />
          <div
            ref={focusEditorRef}
            contentEditable={!previewVersion}
            onInput={handleContentChange}
            onMouseUp={handleTextSelection}
            className={`w-full min-h-[70vh] bg-transparent text-xl font-serif leading-relaxed focus:outline-none ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
            data-placeholder="Start writing..."
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`h-screen flex flex-col relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'}`}
    >
      {/* Toolbar */}
      <header className={`flex items-center justify-between px-6 py-4 border-b backdrop-blur-md sticky top-0 z-10 transition-colors ${theme === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <input 
              type="text"
              value={displayTitle}
              onChange={(e) => onUpdate({ title: e.target.value })}
              readOnly={!!previewVersion}
              className={`text-xl font-bold focus:outline-none bg-transparent ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}
            />
            <span className="text-xs font-medium text-slate-400">{story.type} • {previewVersion ? previewVersion.wordCount : story.wordCount} words</span>
          </div>
        </div>

        <div className={`hidden md:flex items-center gap-2 p-1 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <ToolbarButton 
            icon={<Bold size={18} />} 
            theme={theme} 
            onClick={() => applyFormat('bold')}
          />
          <ToolbarButton 
            icon={<Italic size={18} />} 
            theme={theme} 
            onClick={() => applyFormat('italic')}
          />
          <ToolbarButton 
            icon={<Underline size={18} />} 
            theme={theme} 
            onClick={() => applyFormat('underline')}
          />
          <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          <ToolbarButton icon={<AlignLeft size={18} />} theme={theme} onClick={() => applyFormat('justifyLeft')} />
          <ToolbarButton icon={<AlignCenter size={18} />} theme={theme} onClick={() => applyFormat('justifyCenter')} />
          <ToolbarButton icon={<AlignRight size={18} />} theme={theme} onClick={() => applyFormat('justifyRight')} />
          <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          <ToolbarButton icon={<List size={18} />} theme={theme} onClick={() => applyFormat('insertUnorderedList')} />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className={`p-2 rounded-full transition-colors relative ${showAIAssistant ? 'text-violet-600 bg-violet-50' : theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="AI Assistant"
          >
            <Sparkles size={18} />
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`p-2 rounded-full transition-colors relative ${showComments ? 'text-violet-600 bg-violet-50' : theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Comments"
          >
            <MessageSquare size={18} />
            {comments.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {comments.length}
              </span>
            )}
          </button>
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setIsSplitPane(!isSplitPane)}
            className={`p-2 rounded-full transition-colors ${isSplitPane ? 'text-violet-600 bg-violet-50' : theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Split Pane"
          >
            <BookOpen size={18} />
          </button>
          <button 
            onClick={() => setShowExportModal(true)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Export (Ctrl+Shift+E)"
          >
            <FileDown size={18} />
          </button>
          <button 
            onClick={saveDraft}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Save Draft"
          >
            <Save size={18} />
          </button>
          <button 
            onClick={saveVersion}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Save Version"
          >
            <BookmarkPlus size={18} />
          </button>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-full transition-colors ${showHistory ? 'text-violet-600 bg-violet-50' : theme === 'dark' ? 'text-slate-400 hover:text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}
            title="Version History"
          >
            <History size={18} />
          </button>
          <button 
            onClick={() => setIsFocusMode(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm ml-2"
          >
            <Maximize2 size={16} />
            <span className="hidden sm:inline">Focus Mode</span>
          </button>
        </div>
      </header>

      {previewVersion && (
        <div className="bg-amber-100 text-amber-800 px-6 py-2 flex justify-between items-center text-sm font-medium z-10">
          <span>Previewing version from {new Date(previewVersion.timestamp).toLocaleString()}</span>
          <div className="flex gap-4">
            <button onClick={() => handleRestore(previewVersion)} className="hover:underline flex items-center gap-1"><RotateCcw size={14}/> Restore This Version</button>
            <button onClick={() => setPreviewVersion(null)} className="hover:underline flex items-center gap-1"><X size={14}/> Cancel</button>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className={`flex-1 flex overflow-hidden ${isSplitPane ? 'flex-row' : 'flex-col'} ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50/50'}`}>
        {/* Main Pane */}
        <div className={`flex flex-col overflow-hidden ${isSplitPane ? 'flex-1 border-r' : 'w-full'} ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="max-w-3xl mx-auto w-full py-12 px-8 overflow-y-auto">
            <div
              ref={editorRef}
              contentEditable={!previewVersion}
              onInput={handleContentChange}
              onMouseUp={handleTextSelection}
              className={`w-full min-h-[70vh] bg-transparent text-lg font-serif leading-loose focus:outline-none transition-colors ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}
              data-placeholder="Once upon a time..."
            />
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <AnimatePresence>
          {showAIAssistant && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className={`w-80 border-l flex flex-col z-20 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  <Sparkles size={18} className="text-violet-500" />
                  AI Assistant
                </h3>
                <button onClick={() => setShowAIAssistant(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => handleAIAction('continue')}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    <PenTool size={16} className="text-violet-500" />
                    Continue Writing
                  </button>
                  <button 
                    onClick={() => handleAIAction('rewrite')}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    <RotateCcw size={16} className="text-blue-500" />
                    Rewrite Selection
                  </button>
                  <button 
                    onClick={() => handleAIAction('ideas')}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  >
                    <Lightbulb size={16} className="text-amber-500" />
                    Generate Ideas
                  </button>
                </div>

                {aiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 animate-pulse">Consulting the muse...</p>
                  </div>
                )}

                {aiResponse && !aiLoading && (
                  <div className="space-y-4">
                    <div 
                      className={`p-4 rounded-2xl border text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-violet-50 border-violet-100 text-slate-700'}`}
                      dangerouslySetInnerHTML={{ __html: aiResponse }}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={insertAIResponse}
                        className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-500 transition-colors"
                      >
                        Insert at End
                      </button>
                      <button 
                        onClick={() => setAiResponse('')}
                        className={`px-4 py-3 rounded-xl font-bold text-sm transition-colors ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comments Sidebar */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className={`w-80 border-l flex flex-col z-20 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Comments</h3>
                <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="space-y-4">
                  {selectedTextForComment && (
                    <div className={`p-3 rounded-xl border-l-4 border-violet-500 text-xs italic ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                      "{selectedTextForComment}"
                    </div>
                  )}
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className={`w-full p-4 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                    rows={3}
                  />
                  <button 
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-500 transition-colors disabled:opacity-50"
                  >
                    Post Comment
                  </button>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  {comments.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare size={32} className="mx-auto text-slate-300 mb-3 opacity-20" />
                      <p className="text-xs text-slate-400">No comments yet. Select text to quote it in your comment.</p>
                    </div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="space-y-2 group">
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>{comment.author}</span>
                          <span className="text-[10px] text-slate-400">{comment.timestamp}</span>
                        </div>
                        {comment.quotedText && (
                          <div className={`p-2 rounded-lg border-l-2 border-violet-400 text-[10px] italic ${theme === 'dark' ? 'bg-slate-800/50 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                            "{comment.quotedText}"
                          </div>
                        )}
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{comment.text}</p>
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Second Pane (Split Mode) */}
        {isSplitPane && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <select 
                className={`bg-transparent border-none font-bold focus:ring-0 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                value={secondStoryId || ''}
                onChange={(e) => setSecondStoryId(e.target.value)}
              >
                <option value="">Select a story to compare...</option>
                {stories.filter((s: any) => s.id !== story.id).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button onClick={() => setIsSplitPane(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-8 md:p-12 overflow-y-auto">
              {secondStory ? (
                <>
                  <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{secondStory.title}</h2>
                  <div 
                    className={`text-lg leading-relaxed font-serif ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                    dangerouslySetInnerHTML={{ __html: secondStory.content }}
                  />
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <BookOpen size={48} strokeWidth={1} />
                  <p className="text-sm font-medium">Select a story to view side-by-side.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
        {story.wordCountGoal && (
          <div className="fixed bottom-12 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 z-20">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : progress > 50 ? 'bg-blue-500' : 'bg-violet-500'}`}
            />
          </div>
        )}

        {/* Editor Footer */}
        <div className={`fixed bottom-0 left-0 right-0 h-12 border-t backdrop-blur-md flex items-center justify-between px-6 z-20 transition-all ${theme === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100'} ${isFocusMode && !showStats ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTagPicker(!showTagPicker)}
                className={`p-1.5 rounded-md transition-colors ${showTagPicker ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                title="Quick Tags (Ctrl+Shift+T)"
              >
                <Search size={16} />
              </button>
              <div className="flex gap-1">
                {story.tags?.map((tagId: string) => {
                  const tag = tags.find((t: any) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <div 
                      key={tagId} 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                      title={tag.label}
                    />
                  );
                })}
              </div>
            </div>
            <div className={`w-px h-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
            <button 
              onClick={() => setShowGoalModal(true)}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${story.wordCountGoal ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <CheckCircle2 size={14} />
              {story.wordCountGoal ? `${story.wordCount} / ${story.wordCountGoal}` : 'Set Goal'}
            </button>
          </div>

          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <span>Session:</span>
              <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-600'}>{sessionWords} words</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Total:</span>
              <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-600'}>{story.wordCount} words</span>
            </div>
            {isFocusMode && (
              <button onClick={() => setShowStats(!showStats)} className="hover:text-violet-500 transition-colors">
                {showStats ? <Eye size={14} /> : <Eye size={14} className="opacity-30" />}
              </button>
            )}
          </div>
        </div>

        {/* Quick Tag Picker Overlay */}
        <AnimatePresence>
          {showTagPicker && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`fixed bottom-14 left-6 w-64 rounded-xl shadow-2xl border p-4 z-30 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Quick Tags</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {tags.map((tag: any) => {
                  const isSelected = story.tags?.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        const newTags = isSelected 
                          ? story.tags.filter((id: string) => id !== tag.id)
                          : [...(story.tags || []), tag.id].slice(0, 5);
                        onUpdate({ tags: newTags });
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-violet-50 text-violet-600' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span>{tag.label}</span>
                      </div>
                      {isSelected && <CheckCircle2 size={14} />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Goal Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-xs rounded-2xl shadow-2xl p-6 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
            >
              <h3 className="text-lg font-bold mb-4">Set Word Count Goal</h3>
              <input 
                type="number" 
                placeholder="e.g. 5000"
                value={story.wordCountGoal || ''}
                onChange={(e) => onUpdate({ wordCountGoal: parseInt(e.target.value) || undefined })}
                className={`w-full px-4 py-3 rounded-xl border mb-6 focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => onUpdate({ wordCountGoal: undefined })}
                  className="flex-1 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Remove
                </button>
                <button 
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 py-2 bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-500 transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute right-0 top-0 bottom-0 w-80 shadow-2xl border-l z-50 flex flex-col transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
          >
            <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                <History size={18} />
                Version History
              </h3>
              <button onClick={() => { setShowHistory(false); setPreviewVersion(null); }} className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No saved versions yet. Click the save icon to create one.</p>
              ) : (
                versions.map(v => (
                  <div 
                    key={v.id} 
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${previewVersion?.id === v.id ? 'border-violet-500 bg-violet-50' : theme === 'dark' ? 'border-slate-800 bg-slate-950 hover:border-violet-500/50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}
                    onClick={() => setPreviewVersion(v)}
                  >
                    <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{new Date(v.timestamp).toLocaleString()}</div>
                    <div className="text-xs text-slate-500 flex justify-between items-center">
                      <div className="flex gap-2">
                        <span>{v.wordCount} words</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setExportVersion(v); setShowExportModal(true); }}
                          className="hover:text-violet-500"
                          title="Export this version"
                        >
                          <FileDown size={14} />
                        </button>
                      </div>
                      {previewVersion?.id === v.id && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRestore(v); }}
                          className="text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1 bg-violet-100 px-2 py-1 rounded-md"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ToolbarButton({ icon, active, theme, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-2 rounded-md transition-colors ${active ? (theme === 'dark' ? 'bg-slate-800 text-violet-400 shadow-sm' : 'bg-white shadow-sm text-violet-600') : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50')}`}
    >
      {icon}
    </button>
  );
}

function Reader({ story, onBack, onEdit, theme, showLoading }: any) {
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [fontFamily, setFontFamily] = useState('font-serif');
  const [readerTheme, setReaderTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScrollSpeed > 0) {
      const interval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += 1;
        }
      }, 100 / autoScrollSpeed);
      return () => clearInterval(interval);
    }
  }, [autoScrollSpeed]);

  const handleDownload = async () => {
    await showLoading('Preparing PDF render...', 1200);
    window.print();
  };

  const themeColors = {
    light: 'bg-white text-slate-900',
    dark: 'bg-slate-900 text-slate-100',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]'
  };

  const containerColors = {
    light: 'bg-slate-200/80',
    dark: 'bg-slate-950',
    sepia: 'bg-[#e6dec9]'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`h-screen flex flex-col transition-colors duration-500 ${containerColors[readerTheme]} print:bg-white print:h-auto`}
    >
      {/* Reader Toolbar */}
      <header className={`flex items-center justify-between px-6 py-4 shadow-md z-20 print:hidden transition-colors ${readerTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{story.title}.pdf</h2>
            <p className="text-xs text-slate-400">Rendered from {story.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
            title="Reader Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="Edit Story">
            <PenTool size={20} />
          </button>
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shadow-sm">
            <Download size={16} />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute top-20 right-6 w-80 rounded-2xl shadow-2xl border p-6 z-30 ${readerTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block">Theme</label>
                <div className="flex gap-2">
                  {(['light', 'dark', 'sepia'] as const).map(t => (
                    <button 
                      key={t}
                      onClick={() => setReaderTheme(t)}
                      className={`flex-1 py-2 rounded-lg border-2 capitalize text-sm font-medium transition-all ${readerTheme === t ? 'border-violet-500 bg-violet-500/10 text-violet-600' : 'border-transparent bg-slate-100 text-slate-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block">Font Family</label>
                <div className="flex gap-2">
                  {[
                    { label: 'Serif', value: 'font-serif' },
                    { label: 'Sans', value: 'font-sans' },
                    { label: 'Mono', value: 'font-mono' }
                  ].map(f => (
                    <button 
                      key={f.value}
                      onClick={() => setFontFamily(f.value)}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${fontFamily === f.value ? 'border-violet-500 bg-violet-500/10 text-violet-600' : 'border-transparent bg-slate-100 text-slate-600'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Font Size ({fontSize}px)</label>
                  <input 
                    type="range" min="12" max="32" value={fontSize} 
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-violet-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Line Height ({lineHeight})</label>
                  <input 
                    type="range" min="1" max="3" step="0.1" value={lineHeight} 
                    onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                    className="w-full accent-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Auto-Scroll Speed ({autoScrollSpeed})</label>
                <input 
                  type="range" min="0" max="10" step="1" value={autoScrollSpeed} 
                  onChange={(e) => setAutoScrollSpeed(parseInt(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Set to 0 to disable auto-scroll</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF View */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible transition-colors ${containerColors[readerTheme]}`}
      >
        <div className={`w-full max-w-4xl min-h-[1056px] shadow-2xl rounded-sm p-12 sm:p-24 relative print:shadow-none print:min-h-0 print:p-0 transition-colors ${themeColors[readerTheme]} ${readerTheme === 'dark' ? 'border border-slate-800' : ''}`}>
          {/* Decorative PDF elements */}
          <div className="absolute top-8 right-12 text-xs text-slate-400 font-mono print:hidden">Page 1</div>
          <div className="absolute bottom-8 left-0 right-0 text-center text-xs text-slate-400 font-mono print:hidden">Generated by Inkwell</div>
          
          <h1 className={`text-4xl sm:text-5xl font-bold text-center mb-6 mt-10 ${fontFamily}`}>
            {story.title}
          </h1>
          <div className="w-16 h-1 bg-violet-600 mx-auto mb-16"></div>
          
          <div 
            className={`max-w-none ${fontFamily}`}
            style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
            dangerouslySetInnerHTML={{ __html: story.content || "This document is empty." }}
          />
        </div>
      </div>
    </motion.div>
  );
}
