import React, { useState, useEffect, useRef } from 'react';
import { Syringe, Calendar, CheckCircle2, AlertCircle, Clock, Send, Sparkles, Palette, Edit2, Trash2, Plus } from 'lucide-react';

// כאן נשים בהמשך את ה-Client ID מ-Google Cloud Console
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

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
  const [selectedColor, setSelectedColor] = useState('2'); // Default: Green (Basil)
  const [isEditingMode, setIsEditingMode] = useState(false);
  const tokenClientRef = useRef(null);
  const cachedTokenRef = useRef({ token: null, expiry: 0 });
  
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
              setStatus({ type: 'error', message: 'ההתחברות לגוגל בוטלה או נכשלה.' });
              setLoading(false);
              return;
            }
            // שמור את ה-Token ל-55 דקות (מסתיים ב-60, נשמרים 5 דקות מרווח)
            cachedTokenRef.current = {
              token: tokenResponse.access_token,
              expiry: Date.now() + 55 * 60 * 1000
            };
            await pushToGoogleCalendar(tokenResponse.access_token);
          },
        });
      } else {
        setTimeout(initClient, 200);
      }
    };
    initClient();
  }, []);

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

  const handleSubmit = () => {
    if (shifts.length === 0) {
      setStatus({ type: 'error', message: 'לא זוהו משמרות תקינות. הדביקי את נוסח ההודעה המלא.' });
      return;
    }
    if (!tokenClientRef.current) {
      setStatus({ type: 'error', message: 'שירות Google עדיין נטען, אנא נסי שוב בעוד רגע.' });
      return;
    }

    setLoading(true);

    // אם יש Token קיים ותקף - השתמש בו ישירות בלי לבקש שוב
    const cached = cachedTokenRef.current;
    if (cached.token && Date.now() < cached.expiry) {
      pushToGoogleCalendar(cached.token);
    } else {
      setStatus({ type: 'info', message: 'ממתין לאישור בחשבון גוגל...' });
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    }
  };

  const pushToGoogleCalendar = async (accessToken) => {
    const currentShifts = stateRef.current.shifts;
    const currentColor = stateRef.current.selectedColor;
    
    setStatus({ type: 'info', message: `מזריק ${currentShifts.length} משמרות ליומן...` });

    let count = 0;
    for (const shift of currentShifts) {
      const event = {
        summary: shift.title,
        description: 'הוזרק אוטומטית באמצעות ShiftInjection',
        colorId: currentColor,
        start: {
          dateTime: shift.start.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: shift.end.toISOString(),
          timeZone: 'Asia/Jerusalem',
        },
        reminders: {
          useDefault: false,
          overrides: []
        }
      };

      try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
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
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <header className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <img 
              src="/logo.png" 
              alt="ShiftInjection Logo" 
              className="w-32 h-auto rounded-2xl shadow-lg ring-1 ring-white/10"
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
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ShiftInjection
          </h1>
          <p className="text-sm text-slate-400">
            מדביקים את ה-SMS ומזריקים את הסידור ישירות ל-Google Calendar
          </p>
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
            placeholder="הדביקי כאן את ה-SMS..."
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
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              <span>מזריק ליומן...</span>
            </>
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