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
  Loader2
} from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Types
type StoryType = 'Short Story' | 'Novel' | 'Idea';

interface Story {
  id: string;
  title: string;
  type: StoryType;
  content: string;
  wordCount: number;
  lastEdited: string;
  color: string;
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
    color: 'from-fuchsia-500 to-pink-500'
  },
  {
    id: '2',
    title: 'Echoes of the Past',
    type: 'Short Story',
    content: 'She found the old locket in the attic, covered in dust. As she opened it, a faint melody began to play, and memories she didn\'t know she had flooded her mind. It was a song from a time long forgotten, a time of magic and mystery.',
    wordCount: 3200,
    lastEdited: 'Yesterday',
    color: 'from-violet-500 to-purple-500'
  },
  {
    id: '3',
    title: 'A World Without Sleep',
    type: 'Idea',
    content: 'What if humanity suddenly lost the need to sleep? How would society change? Would we achieve more, or would we go mad from the constant waking state? The protagonist is one of the few who still needs sleep, making them a target.',
    wordCount: 150,
    lastEdited: '3 days ago',
    color: 'from-amber-400 to-orange-500'
  },
  {
    id: '4',
    title: 'The Clockwork King',
    type: 'Short Story',
    content: 'In a kingdom where everything was powered by gears and springs, the King was the most intricate machine of all. But his heart was failing, and the only one who could fix it was a young clockmaker from the slums.',
    wordCount: 4500,
    lastEdited: '1 week ago',
    color: 'from-emerald-400 to-teal-500'
  }
];

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor' | 'reader'>('dashboard');
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

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
             'from-amber-400 to-orange-500'
    };
    setStories([newStory, ...stories]);
    setActiveStoryId(newStory.id);
    setView('editor');
  };

  const handleUpdateStory = (id: string, updates: Partial<Story>) => {
    setStories(stories.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage(`Parsing ${file.name}...`);

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    let content = '';

    try {
      if (extension === 'txt') {
        content = await file.text();
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
        color: wordCount > 5000 ? 'from-fuchsia-500 to-pink-500' : 'from-violet-500 to-purple-500'
      };

      setStories([newStory, ...stories]);
      setActiveStoryId(newStory.id);
      setIsLoading(false);
      setView('editor');
    } catch (error) {
      console.error('Error parsing file:', error);
      setIsLoading(false);
      alert('Error parsing file. Please try again.');
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
        {view === 'dashboard' && (
          <Dashboard 
            key="dashboard"
            stories={stories} 
            theme={theme}
            toggleTheme={toggleTheme}
            onCreate={handleCreateStory}
            onOpenEditor={(id: string) => { setActiveStoryId(id); setView('editor'); }}
            onOpenReader={(id: string) => { setActiveStoryId(id); setView('reader'); }}
          />
        )}
        {view === 'editor' && activeStory && (
          <Editor 
            key="editor"
            story={activeStory}
            theme={theme}
            toggleTheme={toggleTheme}
            onUpdate={(updates: Partial<Story>) => handleUpdateStory(activeStory.id, updates)}
            onBack={() => setView('dashboard')}
            isFocusMode={isFocusMode}
            setIsFocusMode={setIsFocusMode}
            showLoading={showLoading}
          />
        )}
        {view === 'reader' && activeStory && (
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

function Dashboard({ stories, onCreate, onOpenEditor, onOpenReader, theme, toggleTheme }: any) {
  const totalWords = stories.reduce((acc: number, s: any) => acc + s.wordCount, 0);
  const novelsCount = stories.filter((s: any) => s.type === 'Novel').length;
  const shortStoriesCount = stories.filter((s: any) => s.type === 'Short Story').length;
  const ideasCount = stories.filter((s: any) => s.type === 'Idea').length;

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

      {/* Recent Projects */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Recent Projects</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search stories..." 
              className={`pl-10 pr-4 py-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-64 shadow-sm transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {stories.map((story: any) => (
            <motion.div 
              key={story.id}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`rounded-2xl p-6 shadow-sm border transition-all group cursor-pointer flex flex-col h-64 relative overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:shadow-violet-500/10' : 'bg-white border-slate-100 hover:shadow-xl'}`}
              onClick={() => onOpenEditor(story.id)}
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${story.color}`}></div>
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${story.color}`}>
                  {story.type}
                </span>
                <button 
                  className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  onClick={(e) => { e.stopPropagation(); onOpenReader(story.id); }}
                  title="Read PDF Render"
                >
                  <Eye size={18} />
                </button>
              </div>
              
              <h3 className={`text-xl font-bold mb-2 line-clamp-1 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{story.title}</h3>
              <p className={`text-sm line-clamp-3 mb-auto leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {story.content || "No content yet. Start writing..."}
              </p>
              
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
          ))}
        </div>
      </div>
    </motion.div>
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

function Editor({ story, onUpdate, onBack, isFocusMode, setIsFocusMode, theme, toggleTheme, showLoading }: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<StoryVersion[]>([]);
  const [previewVersion, setPreviewVersion] = useState<StoryVersion | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`story_versions_${story.id}`);
    if (stored) {
      try {
        setVersions(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, [story.id]);

  const saveVersion = async () => {
    await showLoading('Saving version...', 600);
    const newVersion: StoryVersion = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title: story.title,
      content: story.content,
      wordCount: story.wordCount
    };
    const updatedVersions = [newVersion, ...versions];
    setVersions(updatedVersions);
    localStorage.setItem(`story_versions_${story.id}`, JSON.stringify(updatedVersions));
  };

  const saveDraft = async () => {
    await showLoading('Autosaving draft...', 500);
    const draft = {
      title: story.title,
      content: story.content,
      wordCount: story.wordCount,
      timestamp: Date.now()
    };
    localStorage.setItem(`autosave_story_${story.id}`, JSON.stringify(draft));
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    onUpdate({ content, wordCount, lastEdited: 'Just now' });
  };

  const displayTitle = previewVersion ? previewVersion.title : story.title;
  const displayContent = previewVersion ? previewVersion.content : story.content;

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
          <textarea
            ref={textareaRef}
            value={displayContent}
            onChange={handleContentChange}
            readOnly={!!previewVersion}
            className={`w-full h-[70vh] bg-transparent text-xl font-serif leading-relaxed resize-none focus:outline-none placeholder-slate-700 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
            placeholder="Start writing..."
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
          <ToolbarButton icon={<Bold size={18} />} theme={theme} />
          <ToolbarButton icon={<Italic size={18} />} theme={theme} />
          <ToolbarButton icon={<Underline size={18} />} theme={theme} />
          <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          <ToolbarButton icon={<AlignLeft size={18} />} active theme={theme} />
          <ToolbarButton icon={<AlignCenter size={18} />} theme={theme} />
          <ToolbarButton icon={<AlignRight size={18} />} theme={theme} />
          <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          <ToolbarButton icon={<List size={18} />} theme={theme} />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
      <div className={`flex-1 overflow-y-auto transition-colors ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50/50'}`}>
        <div className="max-w-3xl mx-auto py-12 px-8">
          <textarea
            ref={textareaRef}
            value={displayContent}
            onChange={handleContentChange}
            readOnly={!!previewVersion}
            className={`w-full min-h-[70vh] bg-transparent text-lg font-serif leading-loose resize-none focus:outline-none placeholder-slate-300 transition-colors ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}
            placeholder="Once upon a time..."
          />
        </div>
      </div>

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
                      <span>{v.wordCount} words</span>
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

function ToolbarButton({ icon, active, theme }: any) {
  return (
    <button className={`p-2 rounded-md transition-colors ${active ? (theme === 'dark' ? 'bg-slate-800 text-violet-400 shadow-sm' : 'bg-white shadow-sm text-violet-600') : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50')}`}>
      {icon}
    </button>
  );
}

function Reader({ story, onBack, onEdit, theme, showLoading }: any) {
  const handleDownload = async () => {
    await showLoading('Preparing PDF render...', 1200);
    window.print();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`h-screen flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-200/80'} print:bg-white print:h-auto`}
    >
      {/* Reader Toolbar */}
      <header className={`flex items-center justify-between px-6 py-4 shadow-md z-10 print:hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white'}`}>
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
          <button onClick={onEdit} className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="Edit Story">
            <PenTool size={20} />
          </button>
          <button className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="Share">
            <Share2 size={20} />
          </button>
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shadow-sm">
            <Download size={16} />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </header>

      {/* PDF View */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible transition-colors ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-200/80'}`}>
        <div className={`w-full max-w-4xl min-h-[1056px] shadow-2xl rounded-sm p-12 sm:p-24 relative print:shadow-none print:min-h-0 print:p-0 transition-colors ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
          {/* Decorative PDF elements */}
          <div className="absolute top-8 right-12 text-xs text-slate-400 font-mono print:hidden">Page 1</div>
          <div className="absolute bottom-8 left-0 right-0 text-center text-xs text-slate-400 font-mono print:hidden">Generated by Inkwell</div>
          
          <h1 className={`text-4xl sm:text-5xl font-serif font-bold text-center mb-6 mt-10 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
            {story.title}
          </h1>
          <div className="w-16 h-1 bg-violet-600 mx-auto mb-16"></div>
          
          <div className={`prose prose-lg sm:prose-xl max-w-none font-serif leading-loose whitespace-pre-wrap ${theme === 'dark' ? 'prose-invert text-slate-300' : 'prose-slate text-slate-800'}`}>
            {story.content || "This document is empty."}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
