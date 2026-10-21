import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Bot, Check, CheckCircle2, ChevronRight, Code2, Compass, Lightbulb, LogOut, MessageCircle, Play, Send, Sparkles, Terminal, Zap } from 'lucide-react';
import './styles.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const DEFAULT_CODE = '# Start by displaying a useful message\n';
const DEFAULT_STATE = (userId, language = 'Python') => ({
  schema_version: 1,
  user_id: userId,
  language,
  project: { title: '', idea: '', requirements: [], target_users: '', constraints: ['Free tools'], finalized: false },
  journey: { started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), current_day: 1, lesson_id: 'lesson-1', lesson_step: 1, completed_lessons: [], status: 'planning' },
  workspace: { persistent_file_name: language === 'C' ? 'main.c' : 'phone_selector.py', code_snapshot: DEFAULT_CODE, last_output: '', last_run_status: 'idle', updated_at: new Date().toISOString() },
  chat_history: [],
  usage: { coach_requests_today: 0, last_request_date: new Date().toISOString().slice(0, 10) }
});
const LESSONS = [
  { id: 'lesson-1', title: 'Make the program speak', concept: 'print()', learn: 'print() text ko terminal mein display karta hai. Pehle output ko control karna seekho.', goal: 'English mein print karo: I am learning coding on CodeQuest.', starter: '# Write your own print statement\n', steps: ['Write and run one print statement.', 'Change the message and run it again.', 'Add a useful message to your own project file.'] },
  { id: 'lesson-2', title: 'Remember a value', concept: 'Variables', learn: 'Variable ek naam hai jise program kisi value ko refer karne ke liye use karta hai.', goal: 'Project ke liye ek value ko variable mein store karke display karo.', starter: '# Store one useful value\n', steps: ['Create one variable and display it.', 'Change the value and observe the output.', 'Store one of your project requirements in a variable.'] },
  { id: 'lesson-3', title: 'Receive a choice', concept: 'input()', learn: 'input() user se text leta hai. Is stage par pehle input ko read aur display karo.', goal: 'User se ek requirement ya choice lo aur display karo.', starter: '# Ask the user for one detail\n', steps: ['Ask for one input.', 'Ask a different question and display the answer.', 'Collect one real detail needed by your project.'] },
  { id: 'lesson-4', title: 'Make a decision', concept: 'if / else', learn: 'Condition True ya False hoti hai. if/else uske hisaab se alag path chalata hai.', goal: 'Ek requirement check karke suitable message display karo.', starter: '# Check one project requirement\n', steps: ['Write a simple condition.', 'Change the condition boundary and test both outcomes.', 'Use one requirement from your project to choose a message.'] },
  { id: 'lesson-5', title: 'Compare options', concept: 'lists + loops', learn: 'List multiple options rakhti hai; loop har option ko process kar sakta hai.', goal: 'Options ko one by one inspect karne ka first version banao.', starter: '# Work through a few options\n', steps: ['Process two values.', 'Add another value and observe the repeated behavior.', 'Apply the loop to your project options.'] },
];

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('cq-user') || 'null'); } catch { return null; } });
  const [page, setPage] = useState('home');
  const [auth, setAuth] = useState({ mode: 'login', username: '', password: '' });
  const [language, setLanguage] = useState('Python');
  const [ctx, setCtx] = useState(() => DEFAULT_STATE(null));
  const [lessonIndex, setLessonIndex] = useState(0);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState('Run your code to see output here.');
  const [runStatus, setRunStatus] = useState('idle');
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [idea, setIdea] = useState('');
  const [requirements, setRequirements] = useState('');
  const [targetUsers, setTargetUsers] = useState('');
  const chatEnd = useRef(null);
  const lesson = LESSONS[Math.min(lessonIndex, LESSONS.length - 1)];

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat]);
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API}/context/${user.id}`).then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.context) return;
      const loaded = data.context;
      setCtx(loaded); setLanguage(loaded.language || 'Python');
      setIdea(loaded.project?.idea || ''); setRequirements((loaded.project?.requirements || []).join(', ')); setTargetUsers(loaded.project?.target_users || '');
      setCode(loaded.workspace?.code_snapshot || DEFAULT_CODE); setOutput(loaded.workspace?.last_output || 'Run your code to see output here.'); setChat(loaded.chat_history || []);
      const current = LESSONS.findIndex(x => x.id === loaded.journey?.lesson_id); if (current >= 0) setLessonIndex(current);
      if (loaded.journey?.status === 'active') setPage('workspace');
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || ctx.journey?.status !== 'active') return undefined;
    const timer = window.setTimeout(() => {
      const next = { ...ctx, user_id: user.id, language, workspace: { ...ctx.workspace, persistent_file_name: language === 'C' ? 'main.c' : 'phone_selector.py', code_snapshot: code, last_output: output === 'Run your code to see output here.' ? '' : output, last_run_status: runStatus, updated_at: new Date().toISOString() }, chat_history: chat };
      fetch(`${API}/context`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, context: next }) }).catch(() => {});
    }, 650);
    return () => window.clearTimeout(timer);
  }, [user?.id, ctx, language, code, output, runStatus, chat]);

  async function persist(next = ctx) {
    if (!user?.id) return;
    try { await fetch(`${API}/context`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, context: { ...next, user_id: user.id, language, workspace: { ...next.workspace, code_snapshot: code, last_output: output, last_run_status: runStatus, updated_at: new Date().toISOString() }, chat_history: chat } }) }); } catch { /* local workspace remains usable */ }
  }
  function goToLanguage() { setError(''); if (user) setPage('language'); else setPage('auth'); }
  async function authSubmit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await fetch(`${API}/auth/${auth.mode === 'register' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: auth.username, password: auth.password }) }); const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Sign-in failed'); setUser(d.user); localStorage.setItem('cq-user', JSON.stringify(d.user)); setCtx(DEFAULT_STATE(d.user.id)); setPage('language'); }
    catch (e2) { setError(e2.message || 'Backend unavailable.'); } finally { setBusy(false); }
  }
  function chooseLanguage(value) { setLanguage(value); setCtx(prev => ({ ...prev, language: value, workspace: { ...prev.workspace, persistent_file_name: value === 'C' ? 'main.c' : 'phone_selector.py' } })); setPage('roadmap'); }
  async function startBrainstorm() {
    const next = { ...ctx, user_id: user?.id, language, project: { ...ctx.project, idea, requirements: requirements.split(',').map(x => x.trim()).filter(Boolean), target_users: targetUsers, constraints: ['Free tools'], finalized: false }, journey: { ...ctx.journey, status: 'planning' } };
    setCtx(next); await persist(next); setChat([{ role: 'assistant', text: 'Pehle real-life problem samajhte hain. Kisko help karna hai, kaunsi decision ya repetitive task mushkil hai, aur kaun se 2–4 rules zaroori hain? Apne words mein batao.' }]); setPage('brainstorm');
  }
  async function askCoach(message = draft, quick = false) {
    const text = message.trim(); if (!text || busy) return;
    const userMessage = { role: 'user', text, at: new Date().toISOString() };
    const history = [...chat, userMessage]; setChat(history); setDraft(''); setBusy(true); setError('');
    const isPlanning = page === 'brainstorm';
    const projectBrief = isPlanning ? `Project idea: ${idea || 'not decided yet'}. Requirements: ${requirements || 'not specified'}. Target user: ${targetUsers || 'not specified'}. Help discover a feasible project by asking one question at a time. Once enough information exists, suggest a small CLI project and ask the learner to confirm; do not claim the project is finalized unless learner confirms.` : `Project: ${ctx.project?.title || idea || 'personal CLI project'}. Idea: ${ctx.project?.idea || idea}. Requirements: ${(ctx.project?.requirements || requirements.split(',')).join(', ')}. Lesson step: ${ctx.journey?.lesson_step || 1}.`;
    try {
      const r = await fetch(`${API}/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language, level: 'beginner', concept: isPlanning ? 'Socratic project discovery' : lesson.concept, goal: isPlanning ? 'Discover and define a small real-life project' : lesson.goal, code, output: output === 'Run your code to see output here.' ? '' : output, learner_message: `${projectBrief}\nConversation so far: ${history.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n')}\nStudent message: ${text}`, hint_level: ctx.journey?.lesson_step || 1 }) });
      const d = await r.json(); const reply = d.reply || 'Try describing the next small part of the problem.'; const nextChat = [...history, { role: 'assistant', text: reply, source: d.source || 'local', at: new Date().toISOString() }]; setChat(nextChat);
      const next = { ...ctx, user_id: user?.id, language, project: { ...ctx.project, idea, requirements: requirements.split(',').map(x => x.trim()).filter(Boolean), target_users: targetUsers }, chat_history: nextChat, usage: { ...ctx.usage, coach_requests_today: (ctx.usage?.coach_requests_today || 0) + 1, last_request_date: new Date().toISOString().slice(0, 10) } }; setCtx(next); if (user?.id) await fetch(`${API}/context`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, context: next }) }).catch(() => {});
    } catch { setChat([...history, { role: 'assistant', text: 'Backend connect nahi ho raha. Backend terminal check karo; apna code local editor mein safe hai.', source: 'local' }]); }
    finally { setBusy(false); }
  }
  async function finalizePlan() {
    const title = idea.trim() ? idea.trim().slice(0, 70) : 'Personal Daily-Life Helper';
    const next = { ...ctx, user_id: user?.id, language, project: { ...ctx.project, title, idea: idea || title, requirements: requirements.split(',').map(x => x.trim()).filter(Boolean), target_users: targetUsers || 'Me and my family', finalized: true }, journey: { ...ctx.journey, status: 'active', started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), current_day: 1, lesson_id: LESSONS[0].id, lesson_step: 1 }, workspace: { ...ctx.workspace, persistent_file_name: language === 'C' ? 'main.c' : 'phone_selector.py', code_snapshot: LESSONS[0].starter } };
    setCtx(next); setLessonIndex(0); setCode(LESSONS[0].starter); setOutput('Run your code to see output here.'); setPage('workspace');
  }
  async function runCode() {
    setBusy(true); setRunStatus('running'); setOutput('Running…');
    try {
      if (language !== 'Python') { setOutput('C runner is not configured in this browser build. Connect your existing compiler service before selecting C for execution.'); setRunStatus('error'); return; }
      if (typeof window.loadPyodide !== 'function') throw new Error('Pyodide CDN load nahi hua. Internet connection aur browser console check karo.');
      window.__cqPyodidePromise ||= window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
      const py = await window.__cqPyodidePromise; let captured = ''; let inputLines = [];
      py.setStdout({ batched: text => { captured += `${text}\n`; } }); py.setStderr({ batched: text => { captured += `${text}\n`; } });
      py.setStdin({ stdin: () => { if (!inputLines.length) { const answer = window.prompt('Program input:') ?? ''; inputLines = Array.from(new TextEncoder().encode(`${answer}\n`)); } return inputLines.shift(); } });
      await py.runPythonAsync(code); const result = captured.trim() || '(Program finished with no output)'; setOutput(result); setRunStatus('success');
    } catch (e) { setOutput(String(e)); setRunStatus('error'); }
    finally { setBusy(false); }
  }
  async function completeStep() {
    if (runStatus !== 'success') { setError('Pehle code run karo aur successful execution confirm karo.'); return; }
    const nextStep = ctx.journey.lesson_step >= 3 ? 1 : ctx.journey.lesson_step + 1;
    let nextIndex = lessonIndex;
    if (ctx.journey.lesson_step >= 3) nextIndex = Math.min(lessonIndex + 1, LESSONS.length - 1);
    const nextLesson = LESSONS[nextIndex];
    const next = { ...ctx, journey: { ...ctx.journey, current_day: Math.min(15, Math.floor(nextIndex / 2) + 1), lesson_id: nextLesson.id, lesson_step: nextStep, completed_lessons: nextStep === 1 ? [...new Set([...(ctx.journey.completed_lessons || []), lesson.id])] : (ctx.journey.completed_lessons || []) }, workspace: { ...ctx.workspace, code_snapshot: code, last_output: output, last_run_status: runStatus, updated_at: new Date().toISOString() } };
    setCtx(next); setLessonIndex(nextIndex); setCode(nextStep === 1 && nextIndex !== lessonIndex ? nextLesson.starter : code); setOutput('Step verified. Apply the idea to the next variation.'); setRunStatus('idle'); setError(''); await persist(next);
  }
  function logout() { localStorage.removeItem('cq-user'); setUser(null); setPage('home'); }

  if (page === 'home') return <Home onStart={goToLanguage} />;
  if (page === 'auth') return <Auth auth={auth} setAuth={setAuth} submit={authSubmit} busy={busy} error={error} />;
  if (page === 'language') return <Language onChoose={chooseLanguage} back={() => setPage('home')} />;
  if (page === 'roadmap') return <Roadmap language={language} onContinue={() => setPage('project')} back={() => setPage('language')} />;
  if (page === 'project') return <ProjectSetup idea={idea} setIdea={setIdea} requirements={requirements} setRequirements={setRequirements} targetUsers={targetUsers} setTargetUsers={setTargetUsers} onContinue={startBrainstorm} back={() => setPage('roadmap')} />;
  if (page === 'brainstorm') return <Brainstorm language={language} chat={chat} draft={draft} setDraft={setDraft} ask={askCoach} busy={busy} idea={idea} setIdea={setIdea} requirements={requirements} setRequirements={setRequirements} targetUsers={targetUsers} setTargetUsers={setTargetUsers} finalize={finalizePlan} back={() => setPage('project')} endRef={chatEnd} />;
  return <Workspace user={user} language={language} lesson={lesson} lessonIndex={lessonIndex} total={LESSONS.length} step={ctx.journey?.lesson_step || 1} project={ctx.project} code={code} setCode={v => { setCode(v); setCtx(prev => ({ ...prev, workspace: { ...prev.workspace, code_snapshot: v, updated_at: new Date().toISOString() } })); }} output={output} runStatus={runStatus} run={runCode} complete={completeStep} chat={chat} draft={draft} setDraft={setDraft} ask={askCoach} busy={busy} error={error} logout={logout} back={() => setPage('brainstorm')} endRef={chatEnd} />;
}
function Brand() { return <div className="brand"><div className="brand-mark"><Code2 size={18} /></div><span>CodeQuest</span><span className="brand-ai">QAI inside</span></div>; }
function Home({ onStart }) { return <main className="landing"><nav><Brand /><span className="nav-note">LEARN BY BUILDING</span></nav><section className="hero"><div className="eyebrow"><Sparkles size={14} /> PERSONAL PROJECT-BASED LEARNING</div><h1>Code for your life.<br /><span>Learn to think.</span></h1><p>QAI helps you turn a real problem from your day into a small program — then teaches only the concepts you need to build it.</p><div className="hero-points"><span><CheckCircle2 size={16} /> Your own project</span><span><CheckCircle2 size={16} /> Hints, not answers</span><span><CheckCircle2 size={16} /> 15-day target</span></div><button className="primary large" onClick={onStart}>Start your journey <ChevronRight size={18} /></button><div className="hero-foot">Python first · C where a compiler service is available · Free-first setup</div></section><div className="landing-orb orb-one"/><div className="landing-orb orb-two"/></main>; }
function Auth({ auth, setAuth, submit, busy, error }) { return <main className="center-page"><div className="auth-card"><Brand /><p className="muted">Save your project and continue where you left off.</p><form onSubmit={submit}><input required minLength="2" placeholder="Username" value={auth.username} onChange={e => setAuth({ ...auth, username: e.target.value })} /><input required minLength="6" type="password" placeholder="Password (minimum 6 characters)" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} /><button className="primary full" disabled={busy}>{busy ? 'Please wait…' : auth.mode === 'login' ? 'Sign in' : 'Create account'}</button></form>{error && <p className="error-text">{error}</p>}<button className="text-button" onClick={() => setAuth({ ...auth, mode: auth.mode === 'login' ? 'register' : 'login' })}>{auth.mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}</button></div></main>; }
function PageFrame({ children, back, backLabel = 'Back' }) { return <main className="onboard"><header className="topbar"><Brand /><button className="quiet-button" onClick={back}><ArrowLeft size={15} /> {backLabel}</button></header><section className="onboard-content">{children}</section></main>; }
function Language({ onChoose, back }) { return <PageFrame back={back}><div className="eyebrow">STEP 01 / LANGUAGE</div><h1>What do you want to learn first?</h1><p className="muted">Choose one language. You can add the other later.</p><div className="language-grid"><button onClick={() => onChoose('Python')} className="language-card"><span className="language-symbol">Py</span><b>Python</b><small>Recommended · Runs in browser with Pyodide</small><ChevronRight /></button><button onClick={() => onChoose('C')} className="language-card"><span className="language-symbol c-symbol">C</span><b>C</b><small>Choose if your compiler service is connected</small><ChevronRight /></button></div></PageFrame>; }
function Roadmap({ language, onContinue, back }) { return <PageFrame back={back}><div className="eyebrow">STEP 02 / COMMITMENT</div><h1>A focused 15-day target.</h1><p className="muted">QAI will help you create a small, useful project and learn only the syntax needed for it.</p><div className="roadmap-card"><div className="roadmap-icon"><Compass size={23} /></div><div><h3>Your learning window</h3><p>15-day target · 30-day maximum working-memory window</p><small>After 30 days, the active QAI project context expires and resets. Download or save your own code separately if you want to keep it.</small></div></div><div className="roadmap-steps"><span><i>01</i> Discover a real problem</span><span><i>02</i> Agree on a project</span><span><i>03</i> Learn through 3-step lessons</span></div><button className="primary" onClick={onContinue}>Define my project <ChevronRight size={17} /></button><p className="tiny-note">Selected language: {language}</p></PageFrame>; }
function ProjectSetup({ idea, setIdea, requirements, setRequirements, targetUsers, setTargetUsers, onContinue, back }) { return <PageFrame back={back}><div className="eyebrow">STEP 03 / YOUR DAILY LIFE</div><h1>Start with a real problem.</h1><p className="muted">You do not need a perfect idea. Give QAI a starting point; refine it together in chat.</p><div className="form-card"><label>What problem do you want to solve? <textarea rows="2" placeholder="e.g. Help my father compare phones against his requirements" value={idea} onChange={e => setIdea(e.target.value)} /></label><label>Who will use it? <input placeholder="e.g. my family, my class, myself" value={targetUsers} onChange={e => setTargetUsers(e.target.value)} /></label><label>Any known requirements? <textarea rows="2" placeholder="e.g. budget, RAM, storage, processor, display" value={requirements} onChange={e => setRequirements(e.target.value)} /></label><button className="primary" onClick={onContinue}>Discuss plan with QAI <MessageCircle size={17} /></button></div><p className="tiny-note">You can leave fields empty. QAI will ask one question at a time.</p></PageFrame>; }
function ChatPanel({ chat, draft, setDraft, ask, busy, quickActions, endRef, planning = false }) { function submit(e) { e.preventDefault(); ask(draft); } return <div className="chat-panel"><div className="chat-heading"><span className="qai-avatar"><Bot size={17} /></span><div><b>QAI Companion</b><small>{planning ? 'Project discovery · one question at a time' : 'Hints first · you stay in control'}</small></div><span className="online-dot" /></div><div className="chat-history">{chat.length === 0 && <div className="chat-empty"><Sparkles size={18} /><p>{planning ? 'Tell QAI about a real problem you have noticed.' : 'Ask about your code, error, or next step.'}</p></div>}{chat.map((m, i) => <div key={`${m.at || ''}-${i}`} className={`chat-row ${m.role === 'user' ? 'user-row' : ''}`}><div className={`chat-bubble ${m.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>{m.role !== 'user' && <span className="bubble-label">QAI · {m.source === 'gemini' ? 'AI' : 'COACH'}</span>}{m.text}</div></div>)}<div ref={endRef} /></div>{quickActions?.length > 0 && <div className="quick-actions">{quickActions.map(action => <button key={action.label} onClick={() => action.run ? action.run() : ask(action.message)} disabled={busy}>{action.label}</button>)}</div>}<form className="chat-input" onSubmit={submit}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={planning ? 'Tell QAI what you need…' : 'Ask in Hinglish or English…'} disabled={busy} /><button aria-label="Send message" disabled={busy || !draft.trim()}><Send size={16} /></button></form></div>; }
function Brainstorm({ language, chat, draft, setDraft, ask, busy, idea, setIdea, requirements, setRequirements, targetUsers, setTargetUsers, finalize, back, endRef }) { return <PageFrame back={back}><div className="eyebrow">STEP 04 / QAI BRAINSTORM</div><h1>Discuss a project that matters to you.</h1><p className="muted">QAI should discover the right project with you, not assign a generic course.</p><div className="brainstorm-layout"><div className="brainstorm-notes"><div className="project-chip"><Sparkles size={15} /> Suggested conversation</div><p className="suggestion">“QAI se baat karke apne daily life ka ek project choose karein jo aap 15 din me banayenge.”</p><label>Working idea<input value={idea} onChange={e => setIdea(e.target.value)} placeholder="A small CLI helper for my family" /></label><label>Requirements, comma-separated<textarea rows="3" value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="Budget, RAM, storage, processor…" /></label><label>Who is it for?<input value={targetUsers} onChange={e => setTargetUsers(e.target.value)} placeholder="My father" /></label><button className="primary full" onClick={finalize}>Confirm plan & jump to editor <ChevronRight size={17} /></button><small className="tiny-note">Only click after the idea feels specific enough to build.</small></div><ChatPanel chat={chat} draft={draft} setDraft={setDraft} ask={ask} busy={busy} planning endRef={endRef} /></div><div className="language-foot">Language: {language} · Project idea can be changed before confirmation.</div></PageFrame>; }
function Workspace({ user, language, lesson, lessonIndex, total, step, project, code, setCode, output, runStatus, run, complete, chat, draft, setDraft, ask, busy, error, logout, back, endRef }) {
  const actions = [...(runStatus === 'success' ? [{ label: 'Next Step', run: complete }] : []), { label: 'Explain this error', message: `Explain this error/output in simple Hinglish: ${output}` }, { label: 'Give me a hint', message: 'Give me one small hint. Do not write the full solution.' }, { label: 'What to do next?', message: 'What is the smallest next step I should try myself?' }];
  return <main className="ide-shell"><header className="ide-topbar"><Brand /><div className="workspace-title"><span className="live-indicator" />{project?.title || 'My learning project'}<span className="language-pill">{language}</span></div><div className="ide-user"><span>{user?.username}</span><button className="icon-quiet" title="Back to plan" onClick={back}><ArrowLeft size={16} /></button><button className="icon-quiet" title="Sign out" onClick={logout}><LogOut size={16} /></button></div></header><div className="ide-layout"><aside className="left-panel"><div className="lesson-top"><div className="eyebrow">DAY {Math.min(15, Math.floor(lessonIndex / 2) + 1)} / 15 · LESSON {lessonIndex + 1}</div><h2>{lesson.title}</h2><div className="lesson-stepper">{[1, 2, 3].map(n => <span className={step === n ? 'active' : step > n ? 'done' : ''} key={n}><i>{step > n ? <Check size={12} /> : n}</i> Step {n}</span>)}</div></div><div className="lesson-content"><div className="concept-card"><div className="card-label">TODAY'S CONCEPT</div><h3>{lesson.concept}</h3><p>{lesson.learn}</p></div><div className="goal-card"><div className="card-label">YOUR CHALLENGE · STEP {step}</div><p>{step === 3 ? `Now integrate this concept into ${project?.title || 'your project'}: ${lesson.goal}` : lesson.steps[step - 1]}</p><small>{lesson.goal}</small></div><div className="project-file"><Code2 size={16} /><div><b>{project?.title || 'Your project'}</b><small>Persistent file · {project?.requirements?.length || 0} requirements saved</small></div></div><div className="session-note"><Zap size={14} /> Context resets after 30 days. Your code file remains yours.</div></div><div className="coach-area"><ChatPanel chat={chat} draft={draft} setDraft={setDraft} ask={ask} busy={busy} quickActions={actions} endRef={endRef} /></div></aside><section className="right-panel"><div className="editor-toolbar"><div className="file-tab"><Code2 size={15} /><span>{project?.persistent_file_name || (language === 'C' ? 'main.c' : 'phone_selector.py')}</span><span className="unsaved-dot" /></div><div className="editor-actions"><span className={`status-pill ${runStatus}`}>{runStatus === 'success' ? 'Success' : runStatus === 'running' ? 'Running' : runStatus === 'error' ? 'Error' : 'Ready'}</span><button className="run-button" onClick={run} disabled={busy}><Play size={14} /> Run</button><button className="complete-button" onClick={complete} disabled={busy}><CheckCircle2 size={14} /> Next Step</button></div></div><div className="monaco-wrap"><Editor height="100%" language={language === 'C' ? 'c' : 'python'} theme="vs-dark" value={code} onChange={v => setCode(v ?? '')} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 18 }, smoothScrolling: true, cursorBlinking: 'smooth', roundedSelection: true }} /></div><section className="terminal-panel"><div className="terminal-head"><div><Terminal size={15} /><b>Terminal</b><span className={`terminal-status ${runStatus}`}>{runStatus.toUpperCase()}</span></div><button onClick={() => navigator.clipboard?.writeText(output)} className="copy-output">Copy output</button></div><pre className={runStatus === 'error' ? 'terminal-error' : ''}>{output}</pre>{error && <p className="inline-error">{error}</p>}</section><footer className="workspace-footer"><span><span className="footer-dot" /> Local browser runtime</span><span>{code.split('\n').length} lines · {code.length} characters</span></footer></section></div></main>;
}

createRoot(document.getElementById('root')).render(<App />);
