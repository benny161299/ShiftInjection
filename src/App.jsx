import React, { useState, useEffect, useRef } from 'react';
import { Syringe, Calendar, CheckCircle2, AlertCircle, Clock, Send, Sparkles, Palette, Edit2, Trash2, Plus } from 'lucide-react';
import './App.css';

// כאן נשים בהמשך את ה-Client ID מ-Google Cloud Console
// ====== Syringe Loader Component ======
function SyringeLoader() {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="56" height="120" viewBox="0 0 56 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Needle tip */}
        <polygon points="28,118 22,105 34,105" fill="#94a3b8" />
        {/* Needle barrel */}
        <rect x="25" y="95" width="6" height="12" fill="#94a3b8" />
        {/* Main barrel */}
        <rect x="14" y="20" width="28" height="78" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {/* Liquid fill - animated */}
        <clipPath id="barrelClip">
          <rect x="16" y="22" width="24" height="74" rx="4" />
        </clipPath>
        <g clipPath="url(#barrelClip)">
          <rect
            x="16" y="22" width="24" height="74" rx="4"
            fill="#10b981" opacity="0.15"
          />
          <rect
            className="syringe-liquid"
            x="16" width="24" rx="3"
            style={{ transformOrigin: 'bottom', fill: '#10b981', position: 'absolute', bottom: 0 }}
            y="22"
            height="74"
            fill="url(#liquidGrad)"
          />
        </g>
        {/* Tick marks */}
        <line x1="42" y1="40" x2="46" y2="40" stroke="#475569" strokeWidth="1.5" />
        <line x1="42" y1="57" x2="46" y2="57" stroke="#475569" strokeWidth="1.5" />
        <line x1="42" y1="74" x2="46" y2="74" stroke="#475569" strokeWidth="1.5" />
        <line x1="42" y1="91" x2="46" y2="91" stroke="#475569" strokeWidth="1.5" />
        {/* Plunger */}
        <g className="syringe-plunger" style={{ transformOrigin: 'top center' }}>
          <rect x="22" y="0" width="12" height="28" rx="3" fill="#34d399" />
          <rect x="10" y="22" width="36" height="8" rx="3" fill="#6ee7b7" />
        </g>
        {/* Drop at the tip */}
        <ellipse className="syringe-drop" cx="28" cy="116" rx="3" ry="4" fill="#10b981" />
        <defs>
          <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>
      <p className="text-sm text-emerald-400 font-medium animate-pulse">מזריק ליומן...</p>
    </div>
  );
}

// ====== Floating Particles ======
function Particles() {
  const particles = [
    { size: 6, left: '10%', delay: '0s', duration: '3.2s' },
    { size: 4, left: '25%', delay: '0.6s', duration: '2.8s' },
    { size: 8, left: '45%', delay: '1.1s', duration: '3.6s' },
    { size: 5, left: '65%', delay: '0.3s', duration: '2.5s' },
    { size: 3, left: '80%', delay: '1.5s', duration: '3s' },
    { size: 7, left: '90%', delay: '0.8s', duration: '3.4s' },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            bottom: '10%',
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

const CALENDAR_COLORS = [
  { id: '1', hex: '#7986cb', name: 'לבנדר' },
  { id: '2', hex: '#33b679', name: 'מרווה' },
  { id: '3', hex: '#8e24aa', name: 'ענב' },
  { id: '4', hex: '#e67c73', name: 'פלמינגו' },
  { id: '5', hex: '#f6c026', name: 'בננה' },
  { id: '6', hex: '#f5511d', name: 'מנדרינה' },
  { id: '7', hex: '#039be5', name: 'טווס' },
  { id: '8', hex: '#616161', name: 'גרפיט' },
  { id: '9', hex: '#3f51b5', name: 'אוכמניה' },
  { id: '10', hex: '#0b8043', name: 'בזיליקום' },
  { id: '11', hex: '#d50000', name: 'עגבניה' }
];

export default function App() {
  const [smsText, setSmsText] = useState('');
  const [shifts, setShifts] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState('2');
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('gcal_token') || null);
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('gcal_user');
    return saved ? JSON.parse(saved) : null;
  });
  const tokenClientRef = useRef(null);
  const pendingInjectionRef = useRef(false);

  const stateRef = useRef({ shifts, selectedColor });
  useEffect(() => {
    stateRef.current = { shifts, selectedColor };
  }, [shifts, selectedColor]);

  useEffect(() => {
    const initClient = () => {
      if (window.google?.accounts?.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'interaction_required' || tokenResponse.error === 'login_required') {
                // החידוש השקט נכשל, צריך אישור משתמשו
                if (pendingInjectionRef.current) {
                  tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
                }
              } else {
                setStatus({ type: 'error', message: 'ההתחברות לגוגל בוטלה או נכשלה.' });
                setLoading(false);
                pendingInjectionRef.current = false;
              }
              return;
            }

            const newToken = tokenResponse.access_token;
            localStorage.setItem('gcal_token', newToken);
            setAccessToken(newToken);

            // שליפת נתוני פרופיל מגוגל
            fetchUserInfo(newToken);

            if (pendingInjectionRef.current) {
              pendingInjectionRef.current = false;
              await pushToGoogleCalendar(newToken);
            }
          },
        });

        // ניסיון רענון שקט בעת טעינת הדף כדי לקבל Token בלי חלון
        tokenClientRef.current.requestAccessToken({ prompt: 'none' });
      } else {
        setTimeout(initClient, 200);
      }
    };
    initClient();
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const profile = { name: data.name, picture: data.picture, email: data.email };
        setUserProfile(profile);
        localStorage.setItem('gcal_user', JSON.stringify(profile));
      }
    } catch (e) {
      console.warn('Could not fetch user info', e);
    }
  };

  const handleLogin = () => {
    if (tokenClientRef.current) {
      pendingInjectionRef.current = false;
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    }
  };

  const handleLogout = () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    localStorage.removeItem('gcal_token');
    localStorage.removeItem('gcal_user');
    setAccessToken(null);
    setUserProfile(null);
    setSmsText('');
    setShifts([]);
    setStatus({ type: '', message: '' });
  };

  const getShiftName = (startH, endH) => {
    if (startH === 7 && endH === 15) return 'משמרת בוקר';
    if (startH === 15 && endH === 23) return 'משמרת ערב';
    if (startH === 23 && endH === 7) return 'משמרת לילה';
    return `משמרת (${startH}:00 - ${endH}:00)`;
  };

  const parseSMS = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    const currentYear = new Date().getFullYear();
    const regex = /(\d{1,2})\.(\d{1,2}).*?מ-\s*(\d{1,2}):(\d{2})\s*עד\s*(\d{1,2}):(\d{2})/;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const startH = parseInt(match[3], 10);
        const startM = parseInt(match[4], 10);
        const endH = parseInt(match[5], 10);
        const endM = parseInt(match[6], 10);

        const startDate = new Date(currentYear, month, day, startH, startM);
        let endDate = new Date(currentYear, month, day, endH, endM);

        // אם המשמרת נגמרת ביום שלמחרת (כמו משמרת לילה 23:00 עד 07:00)
        if (endDate <= startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        parsed.push({
          title: getShiftName(startH, endH),
          start: startDate,
          end: endDate,
          dayStr: `${day}.${month + 1}`,
          timeStr: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        });
      }
    }
    return parsed;
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setSmsText(val);
    setShifts(parseSMS(val));
    setIsEditingMode(false);
    if (status.type) setStatus({ type: '', message: '' });
  };

  const handleShiftUpdate = (index, field, value) => {
    const newShifts = [...shifts];
    const shift = newShifts[index];
    
    if (field === 'title') {
      shift.title = value;
    } else if (field === 'startTime') {
      const [hours, minutes] = value.split(':');
      const updatedStart = new Date(shift.start);
      updatedStart.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      shift.start = updatedStart;
    } else if (field === 'endTime') {
      const [hours, minutes] = value.split(':');
      const updatedEnd = new Date(shift.end);
      updatedEnd.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      
      if (updatedEnd < shift.start && shift.start.getDate() === updatedEnd.getDate()) {
        updatedEnd.setDate(updatedEnd.getDate() + 1);
      }
      shift.end = updatedEnd;
    } else if (field === 'date') {
      const [year, month, day] = value.split('-');
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      const d = parseInt(day, 10);
      
      const durationMs = shift.end.getTime() - shift.start.getTime();
      
      const updatedStart = new Date(shift.start);
      updatedStart.setFullYear(y, m, d);
      shift.start = updatedStart;
      
      const updatedEnd = new Date(updatedStart.getTime() + durationMs);
      shift.end = updatedEnd;
      
      shift.dayStr = `${d}.${m + 1}`;
    }
    
    setShifts(newShifts);
  };

  const handleDeleteShift = (index) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    setShifts(newShifts);
    if (newShifts.length === 0) {
      setIsEditingMode(false);
    }
  };

  const handleAddShift = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0);
    
    const newShift = {
      title: 'משמרת חדשה',
      start: start,
      end: end,
      dayStr: `${start.getDate()}.${start.getMonth() + 1}`,
      timeStr: '08:00 - 16:00'
    };
    
    setShifts([...shifts, newShift]);
  };

  const handleSubmit = async () => {
    if (shifts.length === 0) {
      setStatus({ type: 'error', message: 'לא זוהו משמרות תקינות. הדבק נוסח הודעה מלא.' });
      return;
    }
    if (!tokenClientRef.current) {
      setStatus({ type: 'error', message: 'שירות Google עדיין נטען, אנא נסה שוב בעוד רגע.' });
      return;
    }

    setLoading(true);

    // 1. אם יש Token שמור בדפדפן - נשתמש בו
    if (accessToken) {
      const success = await pushToGoogleCalendar(accessToken);
      if (success !== false) return;
      // הטוקן פג תוקף, ננקה
      localStorage.removeItem('gcal_token');
      setAccessToken(null);
    }

    // 2. נסה רענון שקט (בלי חלון קופץ)
    pendingInjectionRef.current = true;
    tokenClientRef.current.requestAccessToken({ prompt: 'none' });
  };

  const pushToGoogleCalendar = async (token) => {
    const currentShifts = stateRef.current.shifts;
    const currentColor = stateRef.current.selectedColor;

    setStatus({ type: 'info', message: `מזריק ${currentShifts.length} משמרות ליומן...` });

    let count = 0;
    for (const shift of currentShifts) {
      const event = {
        summary: shift.title,
        description: 'הוזרק אוטומטית באמצעות ShiftInjection',
        colorId: currentColor,
        start: { dateTime: shift.start.toISOString(), timeZone: 'Asia/Jerusalem' },
        end: { dateTime: shift.end.toISOString(), timeZone: 'Asia/Jerusalem' },
        reminders: { useDefault: false, overrides: [] }
      };

      try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (res.status === 401) {
          // הטוקן פג תוקף
          setLoading(false);
          return false;
        }
        if (res.ok) count++;
      } catch (err) {
        console.error(err);
      }
    }

    setLoading(false);
    if (count === currentShifts.length) {
      setStatus({ type: 'success', message: `ההזרקה הושלמה בהצלחה! ${count} משמרות הוכנסו ליומן.` });
      setSmsText('');
      setShifts([]);
    } else {
      setStatus({ type: 'info', message: `הועלו ${count} מתוך ${currentShifts.length} משמרות.` });
    }
    return true;
  };

  // מסך התחברות - מוצג אם אין משתמש מחובר
  if (!userProfile) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d2a1f 0%, #020817 60%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: '#10b981' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: '#059669' }} />
        <div className="absolute top-1/2 left-[-120px] w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: '#34d399' }} />

        <Particles />

        {/* Card */}
        <div className="login-card relative z-10 w-full max-w-sm text-center"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(52, 211, 153, 0.15)',
            borderRadius: '24px',
            padding: '40px 32px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}
        >
          {/* Logo with glow */}
          <div className="flex justify-center mb-6">
            <div className="logo-ring">
              <img
                src="/logo.png"
                alt="ShiftInjection Logo"
                className="w-32 h-auto rounded-2xl shadow-2xl"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="hidden items-center justify-center w-20 h-20 rounded-2xl"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <Syringe className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2"
              style={{ textShadow: '0 0 30px rgba(52, 211, 153, 0.3)' }}
            >
              ShiftInjection
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              מדביקים את ה-SMS
              <br />ומזריקים את הסידור ישירות ל-Google Calendar
            </p>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleLogin}
            className="google-btn w-full flex items-center justify-center gap-3 py-4 px-5 rounded-2xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'white',
              color: '#1f2937',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            התחבר עם חשבון Google
          </button>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(71, 85, 105, 0.4)' }} />
            <p className="text-xs text-slate-500">האפליקציה תיצור אירועים ביומן האישי שלך בלבד</p>
            <div className="flex-1 h-px" style={{ background: 'rgba(71, 85, 105, 0.4)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={userProfile.picture}
                alt={userProfile.name}
                className="w-10 h-10 rounded-full ring-2 ring-slate-700"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{userProfile.name}</p>
                <p className="text-xs text-slate-400 leading-tight">{userProfile.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors bg-slate-800 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-500/30"
            >
              יציאה
            </button>
          </div>
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="ShiftInjection Logo"
              className="w-24 h-auto rounded-2xl shadow-lg ring-1 ring-white/10"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="hidden items-center justify-center w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl ring-1 ring-emerald-500/20">
              <Syringe className="w-7 h-7" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">ShiftInjection</h1>
            <p className="text-sm text-slate-400 mt-1">מדביקים את ה-SMS ומזריקים את הסידור ישירות ל-Google Calendar</p>
          </div>
        </header>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>תוכן הודעת הסידור</span>
            {shifts.length > 0 && (
              <span className="text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> זוהו {shifts.length} משמרות
              </span>
            )}
          </label>
          <textarea
            value={smsText}
            onChange={handleTextChange}
            placeholder="הדבק כאן את נוסח ההודעה..."
            rows={5}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none font-mono"
          />
        </div>

        {shifts.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="w-4 h-4" /> צבע האירועים ביומן
              </h2>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                      selectedColor === color.id 
                        ? 'border-white scale-110 shadow-lg' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isEditingMode ? 'עריכת משמרות להזרקה' : 'משמרות להזרקה'}
                </h2>
                {!isEditingMode ? (
                  <button 
                    onClick={() => setIsEditingMode(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> ערוך משמרות
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditingMode(false)}
                    className="text-xs font-medium text-slate-300 hover:text-white transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                  >
                    סיום עריכה
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 pb-1">
                {!isEditingMode ? (
                  shifts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-sm shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: CALENDAR_COLORS.find(c => c.id === selectedColor)?.hex || '#3f51b5' }}
                        ></span>
                        <span className="font-medium text-slate-200">{s.title}</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-mono border border-slate-700/50">
                          {s.dayStr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>{`${String(s.start.getHours()).padStart(2, '0')}:${String(s.start.getMinutes()).padStart(2, '0')} - ${String(s.end.getHours()).padStart(2, '0')}:${String(s.end.getMinutes()).padStart(2, '0')}`}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  shifts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm shadow-sm transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 w-full pr-8">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: CALENDAR_COLORS.find(c => c.id === selectedColor)?.hex || '#3f51b5' }}
                          ></span>
                          <input 
                            type="text" 
                            value={s.title}
                            onChange={(e) => handleShiftUpdate(idx, 'title', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium px-1 py-0.5 w-full transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteShift(idx)}
                          className="absolute left-3 top-3.5 text-slate-500 hover:text-red-400 transition-colors bg-slate-900 hover:bg-red-500/10 p-1.5 rounded-md"
                          title="מחק משמרת"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-xs font-medium text-slate-400">תאריך:</span>
                          <input 
                            type="date" 
                            value={`${s.start.getFullYear()}-${String(s.start.getMonth() + 1).padStart(2, '0')}-${String(s.start.getDate()).padStart(2, '0')}`}
                            onChange={(e) => handleShiftUpdate(idx, 'date', e.target.value)}
                            className="bg-slate-950 rounded-md px-2 py-1 text-sm text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">מ-</span>
                          <input 
                            type="time" 
                            value={`${String(s.start.getHours()).padStart(2, '0')}:${String(s.start.getMinutes()).padStart(2, '0')}`}
                            onChange={(e) => handleShiftUpdate(idx, 'startTime', e.target.value)}
                            className="bg-slate-950 rounded-md px-2 py-1 text-sm text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">עד-</span>
                          <input 
                            type="time" 
                            value={`${String(s.end.getHours()).padStart(2, '0')}:${String(s.end.getMinutes()).padStart(2, '0')}`}
                            onChange={(e) => handleShiftUpdate(idx, 'endTime', e.target.value)}
                            className="bg-slate-950 rounded-md px-2 py-1 text-sm text-slate-300 border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isEditingMode && (
                  <button 
                    onClick={handleAddShift}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-sm font-medium mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    הוסף משמרת חדשה
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || shifts.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-medium text-sm transition-all duration-200 bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <SyringeLoader />
            </div>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>הזרק משמרות ליומן Google</span>
            </>
          )}
        </button>

        {status.message && (
          <div
            className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 border ${
              status.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : status.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}
          >
            {status.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}
      </main>
    </div>
  );
}