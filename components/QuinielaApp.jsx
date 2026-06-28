'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Target,
  Trophy,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  Medal,
  Download,
  Lock,
  Unlock,
  X,
  Pencil,
  FileText,
  Ban,
} from 'lucide-react';
import { storageGet, storageSet } from '../lib/storage';

const SCORE_START_DATE = '2026-06-28';

const COLORS = {
  pitchDark: '#16302A',
  pitch: '#1F4D3E',
  pitchLight: '#2D6A4F',
  chalk: '#F7F4ED',
  chalkDim: 'rgba(247,244,237,0.65)',
  amber: '#FFB627',
  coral: '#E76F51',
  line: 'rgba(247,244,237,0.14)',
  lineDark: 'rgba(22,48,42,0.12)',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatFecha = (fecha) => {
  if (!fecha) return '';
  const parts = fecha.split('-');
  if (parts.length !== 3) return fecha;
  const [y, m, d] = parts;
  const mi = Number(m) - 1;
  if (mi < 0 || mi > 11 || !d) return fecha;
  return `${d} ${MESES[mi]}`;
};

const slugify = (name) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Puntos de UN partido para UNA predicción. null = el partido aún no tiene resultado.
const matchPoints = (pick, m) => {
  if (m.fecha && m.fecha < SCORE_START_DATE) return 0;
  
  if (m.scoreA === null || m.scoreB === null) return null;
  if (!pick || pick.a === '' || pick.b === '' || pick.a === undefined || pick.b === undefined) return 0;
  const pa = Number(pick.a);
  const pb = Number(pick.b);
  if (pa === m.scoreA && pb === m.scoreB) return 5;
  if (Math.sign(pa - pb) === Math.sign(m.scoreA - m.scoreB)) return 3;
  return 0;
};

// 5 pts por marcador exacto, 3 pts por acertar solo el resultado (ganador/empate)
const scorePlayer = (picks, matchList) => {
  let points = 0,
    exactos = 0,
    aciertos = 0,
    jugados = 0;
  matchList.forEach((m) => {
    const pts = matchPoints(picks[m.id], m);
    if (pts === null) return;
    jugados++;
    if (pts === 5) {
      exactos++;
      aciertos++;
    } else if (pts === 3) {
      aciertos++;
    }
    points += pts;
  });
  return { points, exactos, aciertos, jugados };
};

const csvEscape = (val) => {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const ScoreBox = ({ value, onChange, disabled, accent }) => (
  <input
    type="number"
    min="0"
    max="99"
    inputMode="numeric"
    value={value}
    disabled={disabled}
    onChange={(e) => {
      const v = e.target.value;
      if (v === '' || (/^\d{0,2}$/.test(v) && Number(v) <= 99)) onChange(v);
    }}
    placeholder="-"
    style={{
      width: '2.75rem',
      height: '2.75rem',
      background: COLORS.pitchDark,
      color: accent || COLORS.amber,
      fontFamily: "'JetBrains Mono', monospace",
      border: `1px solid ${disabled ? 'rgba(247,244,237,0.08)' : 'rgba(255,182,39,0.35)'}`,
      borderRadius: '0.375rem',
      opacity: disabled ? 0.5 : 1,
    }}
    className="text-center text-lg font-bold focus:outline-none focus:ring-2"
  />
);

export default function App() {
  const [tab, setTab] = useState('predicciones');
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [adminPin, setAdminPin] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const [newMatch, setNewMatch] = useState({ teamA: '', teamB: '', fase: '', fecha: '', hora: '' });
  const [resultInputs, setResultInputs] = useState({});
  const [savingResult, setSavingResult] = useState(null);

  const [nameInput, setNameInput] = useState('');
  const [activeName, setActiveName] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [myPicks, setMyPicks] = useState({});
  const [picksLoading, setPicksLoading] = useState(false);
  const [picksSaving, setPicksSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [tablaLoading, setTablaLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      const res = await storageGet('matches');
      return res ? JSON.parse(res.value) : [];
    } catch {
      return [];
    }
  }, []);

  const loadPlayers = useCallback(async () => {
    try {
      const res = await storageGet('players');
      return res ? JSON.parse(res.value) : [];
    } catch {
      return [];
    }
  }, []);

  const loadAdminPin = useCallback(async () => {
    try {
      const res = await storageGet('admin-pin');
      return res ? res.value : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [m, p, pin] = await Promise.all([loadMatches(), loadPlayers(), loadAdminPin()]);
      setMatches(m);
      setPlayers(p);
      setAdminPin(pin);
      setLoading(false);
    })();
  }, [loadMatches, loadPlayers, loadAdminPin]);

  useEffect(() => {
    setResultInputs((prev) => {
      const next = { ...prev };
      matches.forEach((m) => {
        if (!(m.id in next)) {
          next[m.id] = {
            a: m.scoreA === null || m.scoreA === undefined ? '' : String(m.scoreA),
            b: m.scoreB === null || m.scoreB === undefined ? '' : String(m.scoreB),
          };
        }
      });
      return next;
    });
  }, [matches]);

  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    const [m, p] = await Promise.all([loadMatches(), loadPlayers()]);
    setMatches(m);
    setPlayers(p);
    if (tab === 'tabla') await computeLeaderboard(m, p);
    setRefreshing(false);
  };

  // ---------- Acceso de organizador ----------
  const submitPin = async () => {
    const val = pinInput.trim();
    if (!val) return;
    setPinError('');
    if (adminPin === null) {
      setPinSaving(true);
      try {
        const res = await storageSet('admin-pin', val);
        if (!res) throw new Error('fail');
        setAdminPin(val);
        setIsAdmin(true);
        setShowPinPrompt(false);
        setPinInput('');
        setTab('partidos');
      } catch {
        setPinError('No se pudo guardar el PIN. Intenta de nuevo.');
      } finally {
        setPinSaving(false);
      }
    } else if (val === adminPin) {
      setIsAdmin(true);
      setShowPinPrompt(false);
      setPinInput('');
      setTab('partidos');
    } else {
      setPinError('PIN incorrecto.');
    }
  };

  const lockAdmin = () => {
    setIsAdmin(false);
    if (tab === 'partidos') setTab('predicciones');
  };

  // ---------- Partidos ----------
  const addMatch = async () => {
    if (!newMatch.teamA.trim() || !newMatch.teamB.trim()) return;
    const match = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      teamA: newMatch.teamA.trim(),
      teamB: newMatch.teamB.trim(),
      fase: newMatch.fase.trim(),
      fecha: newMatch.fecha,
      hora: newMatch.hora,
      scoreA: null,
      scoreB: null,
      predictionsClosed: false,
    };
    const updated = [...matches, match];
    try {
      const res = await storageSet('matches', JSON.stringify(updated));
      if (!res) throw new Error('fail');
      setMatches(updated);
      setNewMatch({ teamA: '', teamB: '', fase: '', fecha: '', hora: '' });
    } catch {
      setError('No se pudo guardar el partido. Intenta de nuevo.');
    }
  };

  const deleteMatch = async (id) => {
    const updated = matches.filter((m) => m.id !== id);
    try {
      const res = await storageSet('matches', JSON.stringify(updated));
      if (!res) throw new Error('fail');
      setMatches(updated);
    } catch {
      setError('No se pudo eliminar el partido.');
    }
  };

  // Guarda cambios genéricos sobre un partido (resultado, edición, cierre de predicciones)
  const updateMatch = async (id, fields) => {
    const updated = matches.map((m) => (m.id === id ? { ...m, ...fields } : m));
    try {
      const res = await storageSet('matches', JSON.stringify(updated));
      if (!res) throw new Error('fail');
      setMatches(updated);
      return true;
    } catch {
      setError('No se pudo guardar el cambio.');
      return false;
    }
  };

  const saveResult = async (id) => {
    const input = resultInputs[id] || { a: '', b: '' };
    setSavingResult(id);
    await updateMatch(id, {
      scoreA: input.a === '' ? null : Number(input.a),
      scoreB: input.b === '' ? null : Number(input.b),
    });
    setSavingResult(null);
  };

  const togglePredictions = async (id, currentlyClosed) => {
    await updateMatch(id, { predictionsClosed: !currentlyClosed });
  };

  // ---------- Mis Predicciones ----------
  const enterAs = async (name) => {
    
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = slugify(trimmed) || Math.random().toString(36).slice(2, 8);
    setPicksLoading(true);
    setError(null);
    try {
      const res = await storageGet(`predictions:${key}`);
      setMyPicks(res ? JSON.parse(res.value) : {});
    } catch {
      setMyPicks({});
    }
    
    if (!player) {
      setError('Ese jugador no existe. Pide al organizador que lo registre.');
      setPicksLoading(false);
      return;
    }
    setActiveName(trimmed);
    setActiveKey(key);
    setPicksLoading(false);
  };

  const updatePick = (matchId, field, value) => {
    if (value !== '' && !(/^\d{0,2}$/.test(value) && Number(value) <= 99)) return;
    setMyPicks((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || {}), [field]: value },
    }));
  };

  const savePicks = async () => {
    setPicksSaving(true);
    try {
      const updated = { ...myPicks };
      Object.keys(updated).forEach((id) => {
        const p = updated[id];
        if (p && p.a !== '' && p.b !== '' && p.a !== undefined && p.b !== undefined) {
          updated[id] = { ...p, locked: true };
        }
      });
      const res = await storageSet(`predictions:${activeKey}`, JSON.stringify(updated));
      if (!res) throw new Error('fail');
      setMyPicks(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      setError('No se pudieron guardar tus predicciones. Intenta de nuevo.');
    } finally {
      setPicksSaving(false);
    }
  };

  // ---------- Tabla ----------
  const computeLeaderboard = async (matchList = matches, playerList = players) => {
    setTablaLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        playerList.map(async (player) => {
          let picks = {};
          try {
            const res = await storageGet(`predictions:${player.key}`);
            picks = res ? JSON.parse(res.value) : {};
          } catch {
            picks = {};
          }
          const score = scorePlayer(picks, matchList);
          return { name: player.name, ...score };
        })
      );
      results.sort((a, b) => b.points - a.points || b.exactos - a.exactos || a.name.localeCompare(b.name));
      setLeaderboard(results);
    } catch {
      setError('No se pudo calcular la tabla.');
    } finally {
      setTablaLoading(false);
    }
  };

  // ---------- Exportar (solo organizador) ----------
  const exportData = async () => {
    setExporting(true);
    setError(null);
    try {
      const jugadores = await Promise.all(
        players.map(async (player) => {
          let picks = {};
          try {
            const res = await storageGet(`predictions:${player.key}`);
            picks = res ? JSON.parse(res.value) : {};
          } catch {
            picks = {};
          }
          const score = scorePlayer(picks, matches);
          return { nombre: player.name, predicciones: picks, ...score };
        })
      );
      jugadores.sort((a, b) => b.points - a.points || b.exactos - a.exactos);

      const data = {
        exportadoEn: new Date().toISOString(),
        partidos: matches,
        jugadores,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiniela-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo generar el respaldo.');
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = async () => {
    setExportingCSV(true);
    setError(null);
    try {
      const header = ['Jugador'];
      matches.forEach((m) => {
        const label = `${m.teamA} vs ${m.teamB}`;
        header.push(`${label} - Predicción`);
        header.push(`${label} - Puntos`);
      });
      header.push('Total');
      const rows = [header];

      for (const player of players) {
        let picks = {};
        try {
          const res = await storageGet(`predictions:${player.key}`);
          picks = res ? JSON.parse(res.value) : {};
        } catch {
          picks = {};
        }
        const row = [player.name];
        let total = 0;
        matches.forEach((m) => {
          const p = picks[m.id];
          const hasPick = p && p.a !== '' && p.b !== '' && p.a !== undefined && p.b !== undefined;
          row.push(hasPick ? `${p.a}-${p.b}` : '');
          const pts = matchPoints(p, m);
          row.push(pts === null ? '' : String(pts));
          if (pts) total += pts;
        });
        row.push(String(total));
        rows.push(row);
      }

      const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiniela-predicciones-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo generar el CSV.');
    } finally {
      setExportingCSV(false);
    }
  };

  useEffect(() => {
    if (tab === 'tabla' && !loading) computeLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loading]);

  const playedCount = matches.filter((m) => m.scoreA !== null && m.scoreB !== null).length;

  const TABS = [
    ...(isAdmin ? [{ id: 'partidos', label: 'Partidos', icon: CalendarDays }] : []),
    { id: 'predicciones', label: 'Mis Predicciones', icon: Target },
    { id: 'tabla', label: 'Tabla', icon: Trophy },
  ];

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif", background: COLORS.pitchDark, minHeight: '100%' }}
      className="w-full"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@600;700&display=swap');
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .quiniela-display { font-family: 'Oswald', sans-serif; }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <p
              className="quiniela-display text-xs sm:text-sm uppercase tracking-[0.3em]"
              style={{ color: COLORS.amber }}
            >
              Quiniela
            </p>
            <h1
              className="quiniela-display text-3xl sm:text-4xl font-bold uppercase tracking-wide"
              style={{ color: COLORS.chalk }}
            >
              Mundial 2026
            </h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: COLORS.chalkDim }}>
              5 pts por marcador exacto &middot; 3 pts por acertar el resultado &middot; {playedCount} partido
              {playedCount === 1 ? '' : 's'} jugado{playedCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end shrink-0">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-md whitespace-nowrap"
              style={{ background: COLORS.pitch, color: COLORS.chalk, border: `1px solid ${COLORS.line}` }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Actualizar
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={exportData}
                  disabled={exporting}
                  className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-md whitespace-nowrap"
                  style={{ background: COLORS.pitch, color: COLORS.chalk, border: `1px solid ${COLORS.line}` }}
                  title="Descargar respaldo en JSON"
                >
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Respaldo
                </button>
                <button
                  onClick={exportCSV}
                  disabled={exportingCSV}
                  className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-md whitespace-nowrap"
                  style={{ background: COLORS.pitch, color: COLORS.chalk, border: `1px solid ${COLORS.line}` }}
                  title="Descargar predicciones y puntos en CSV"
                >
                  {exportingCSV ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  CSV
                </button>
              </>
            )}
            {isAdmin ? (
              <button
                onClick={lockAdmin}
                className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-md whitespace-nowrap"
                style={{ background: COLORS.pitchLight, color: COLORS.chalk, border: `1px solid ${COLORS.line}` }}
                title="Salir del modo organizador"
              >
                <Unlock size={14} />
                Organizador
              </button>
            ) : (
              <button
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                  setShowPinPrompt(true);
                }}
                className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-md whitespace-nowrap"
                style={{ background: COLORS.pitch, color: COLORS.chalkDim, border: `1px solid ${COLORS.line}` }}
                title="Acceso de organizador"
              >
                <Lock size={14} />
                Organizador
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-sm"
            style={{ background: 'rgba(231,111,81,0.15)', color: COLORS.coral, border: `1px solid ${COLORS.coral}` }}
          >
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-t-lg text-xs sm:text-sm quiniela-display uppercase tracking-wide transition-colors"
                style={{
                  background: active ? COLORS.chalk : COLORS.pitch,
                  color: active ? COLORS.pitchDark : COLORS.chalkDim,
                  fontWeight: active ? 700 : 400,
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="rounded-b-lg p-4 sm:p-5" style={{ background: COLORS.chalk, minHeight: '320px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16" style={{ color: COLORS.pitch }}>
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : tab === 'partidos' ? (
            <PartidosTab
              matches={matches}
              resultInputs={resultInputs}
              setResultInputs={setResultInputs}
              saveResult={saveResult}
              savingResult={savingResult}
              deleteMatch={deleteMatch}
              updateMatch={updateMatch}
              togglePredictions={togglePredictions}
              newMatch={newMatch}
              setNewMatch={setNewMatch}
              addMatch={addMatch}
            />
          ) : tab === 'predicciones' ? (
            <PrediccionesTab
              matches={matches}
              activeName={activeName}
              picksLoading={picksLoading}
              nameInput={nameInput}
              setNameInput={setNameInput}
              enterAs={enterAs}
              myPicks={myPicks}
              updatePick={updatePick}
              savePicks={savePicks}
              picksSaving={picksSaving}
              saved={saved}
              switchPlayer={() => {
                setActiveName(null);
                setActiveKey(null);
                setMyPicks({});
                setNameInput('');
              }}
            />
          ) : (
            <TablaTab leaderboard={leaderboard} loading={tablaLoading} matches={matches} />
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: COLORS.chalkDim }}>
          Comparte este enlace con tus amigos &mdash; todos verán los mismos partidos y la misma tabla.
        </p>
      </div>

      {showPinPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowPinPrompt(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg p-4"
            style={{ background: COLORS.chalk }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="quiniela-display text-sm uppercase tracking-wide" style={{ color: COLORS.pitchDark }}>
                {adminPin === null ? 'Crear PIN de organizador' : 'Acceso de organizador'}
              </p>
              <button onClick={() => setShowPinPrompt(false)} style={{ color: COLORS.pitch }}>
                <X size={18} />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: COLORS.pitchLight }}>
              {adminPin === null
                ? 'Elige un PIN. Solo quien lo conozca podrá ver y editar la pestaña "Partidos", y descargar los respaldos.'
                : 'Ingresa el PIN para ver y editar los partidos.'}
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPin()}
              placeholder="PIN"
              className="w-full px-3 py-2 rounded text-sm mb-2"
              style={{ border: `1px solid ${COLORS.lineDark}` }}
            />
            {pinError && (
              <p className="text-xs mb-2" style={{ color: COLORS.coral }}>
                {pinError}
              </p>
            )}
            <button
              onClick={submitPin}
              disabled={!pinInput.trim() || pinSaving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm quiniela-display uppercase tracking-wide disabled:opacity-50"
              style={{ background: COLORS.pitch, color: COLORS.chalk }}
            >
              {pinSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {adminPin === null ? 'Crear y entrar' : 'Entrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PartidosTab({
  matches,
  resultInputs,
  setResultInputs,
  saveResult,
  savingResult,
  deleteMatch,
  updateMatch,
  togglePredictions,
  newMatch,
  setNewMatch,
  addMatch,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editInputs, setEditInputs] = useState({ teamA: '', teamB: '', fase: '', fecha: '', hora: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditInputs({ teamA: m.teamA, teamB: m.teamB, fase: m.fase || '', fecha: m.fecha || '', hora: m.hora || '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    if (!editInputs.teamA.trim() || !editInputs.teamB.trim()) return;
    setSavingEdit(true);
    const ok = await updateMatch(id, {
      teamA: editInputs.teamA.trim(),
      teamB: editInputs.teamB.trim(),
      fase: editInputs.fase.trim(),
      fecha: editInputs.fecha,
      hora: editInputs.hora,
    });
    setSavingEdit(false);
    if (ok) setEditingId(null);
  };

  const handleToggle = async (m) => {
    setTogglingId(m.id);
    await togglePredictions(m.id, !!m.predictionsClosed);
    setTogglingId(null);
  };

  const inputStyle = { border: `1px solid ${COLORS.lineDark}` };

  return (
    <div>
      <div className="mb-5 p-3 rounded-md" style={{ background: 'rgba(31,77,62,0.06)', border: `1px solid ${COLORS.lineDark}` }}>
        <p className="quiniela-display text-sm uppercase tracking-wide mb-2" style={{ color: COLORS.pitch }}>
          Agregar partido
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            placeholder="Equipo local"
            value={newMatch.teamA}
            onChange={(e) => setNewMatch({ ...newMatch, teamA: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
          <input
            placeholder="Equipo visitante"
            value={newMatch.teamB}
            onChange={(e) => setNewMatch({ ...newMatch, teamB: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input
            placeholder="Fase (ej. Grupo A)"
            value={newMatch.fase}
            onChange={(e) => setNewMatch({ ...newMatch, fase: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
          <input
            type="date"
            value={newMatch.fecha}
            onChange={(e) => setNewMatch({ ...newMatch, fecha: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
          <input
            type="time"
            value={newMatch.hora}
            onChange={(e) => setNewMatch({ ...newMatch, hora: e.target.value })}
            className="px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
        </div>
        <button
          onClick={addMatch}
          disabled={!newMatch.teamA.trim() || !newMatch.teamB.trim()}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md quiniela-display uppercase tracking-wide disabled:opacity-40"
          style={{ background: COLORS.pitch, color: COLORS.chalk }}
        >
          <Plus size={15} /> Agregar
        </button>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: COLORS.pitch }}>
          Aún no hay partidos. Agrega el primero arriba para empezar la quiniela.
        </p>
      ) : (
        <div className="space-y-2">
          {[...matches]
            .sort((a, b) => {
              // Orden: fecha descendente, y dentro del mismo día, hora ascendente.
              const fa = a.fecha || '';
              const fb = b.fecha || '';
              if (fa !== fb) return fb.localeCompare(fa);
              const ha = a.hora || '';
              const hb = b.hora || '';
              return ha.localeCompare(hb);
            })
            .map((m) => {
            const input = resultInputs[m.id] || { a: '', b: '' };
            const played = m.scoreA !== null && m.scoreB !== null;
            const isEditing = editingId === m.id;
            const closed = !!m.predictionsClosed;

            return (
              <div key={m.id} className="py-2.5 px-2 rounded-md" style={{ borderBottom: `1px solid ${COLORS.lineDark}` }}>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Equipo local"
                        value={editInputs.teamA}
                        onChange={(e) => setEditInputs({ ...editInputs, teamA: e.target.value })}
                        className="px-2 py-1.5 rounded text-sm"
                        style={inputStyle}
                      />
                      <input
                        placeholder="Equipo visitante"
                        value={editInputs.teamB}
                        onChange={(e) => setEditInputs({ ...editInputs, teamB: e.target.value })}
                        className="px-2 py-1.5 rounded text-sm"
                        style={inputStyle}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        placeholder="Fase (ej. Grupo A)"
                        value={editInputs.fase}
                        onChange={(e) => setEditInputs({ ...editInputs, fase: e.target.value })}
                        className="px-2 py-1.5 rounded text-sm"
                        style={inputStyle}
                      />
                      <input
                        type="date"
                        value={editInputs.fecha}
                        onChange={(e) => setEditInputs({ ...editInputs, fecha: e.target.value })}
                        className="px-2 py-1.5 rounded text-sm"
                        style={inputStyle}
                      />
                      <input
                        type="time"
                        value={editInputs.hora}
                        onChange={(e) => setEditInputs({ ...editInputs, hora: e.target.value })}
                        className="px-2 py-1.5 rounded text-sm"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(m.id)}
                        disabled={savingEdit || !editInputs.teamA.trim() || !editInputs.teamB.trim()}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md quiniela-display uppercase tracking-wide disabled:opacity-40"
                        style={{ background: COLORS.pitch, color: COLORS.chalk }}
                      >
                        {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Guardar
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-sm px-3 py-1.5 rounded-md quiniela-display uppercase tracking-wide"
                        style={{ background: 'transparent', color: COLORS.pitch, border: `1px solid ${COLORS.lineDark}` }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      {(m.fase || m.fecha || m.hora) && (
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: COLORS.pitchLight }}>
                          {[m.fase, formatFecha(m.fecha), m.hora].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="quiniela-display text-sm sm:text-base uppercase truncate" style={{ color: COLORS.pitchDark }}>
                        {m.teamA} <span style={{ color: COLORS.amber }}>vs</span> {m.teamB}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {played && (
                          <p className="text-[10px]" style={{ color: COLORS.pitchLight }}>
                            Resultado registrado
                          </p>
                        )}
                        {closed && (
                          <p className="text-[10px]" style={{ color: COLORS.coral }}>
                            Predicciones cerradas
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <ScoreBox
                        value={input.a}
                        onChange={(v) => setResultInputs((prev) => ({ ...prev, [m.id]: { ...input, a: v } }))}
                      />
                      <span style={{ color: COLORS.pitchDark }}>-</span>
                      <ScoreBox
                        value={input.b}
                        onChange={(v) => setResultInputs((prev) => ({ ...prev, [m.id]: { ...input, b: v } }))}
                      />
                      <button
                        onClick={() => saveResult(m.id)}
                        className="p-2 rounded-md"
                        style={{ background: COLORS.pitchLight, color: COLORS.chalk }}
                        title="Guardar resultado"
                      >
                        {savingResult === m.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button
                        onClick={() => handleToggle(m)}
                        className="p-2 rounded-md"
                        style={{
                          background: closed ? 'rgba(45,106,79,0.15)' : 'rgba(231,111,81,0.12)',
                          color: closed ? COLORS.pitchLight : COLORS.coral,
                        }}
                        title={closed ? 'Volver a aceptar predicciones' : 'Cerrar predicciones para este partido'}
                      >
                        {togglingId === m.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : closed ? (
                          <Unlock size={16} />
                        ) : (
                          <Ban size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(m)}
                        className="p-2 rounded-md"
                        style={{ background: 'rgba(31,77,62,0.08)', color: COLORS.pitch }}
                        title="Editar partido"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteMatch(m.id)}
                        className="p-2 rounded-md"
                        style={{ background: 'rgba(231,111,81,0.12)', color: COLORS.coral }}
                        title="Eliminar partido"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrediccionesTab({
  matches,
  activeName,
  picksLoading,
  nameInput,
  setNameInput,
  enterAs,
  myPicks,
  updatePick,
  savePicks,
  picksSaving,
  saved,
  switchPlayer,
}) {
  const [page, setPage] = useState(0);

  if (!activeName) {
    return (
      <div className="py-6 text-center">
        <Target size={28} className="mx-auto mb-3" style={{ color: COLORS.pitch }} />
        <p className="text-sm mb-3" style={{ color: COLORS.pitchDark }}>
          Escribe tu nombre para cargar (o crear) tus predicciones.
        </p>
        <div className="flex gap-2 max-w-xs mx-auto">
          <input
            placeholder="Tu nombre"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enterAs(nameInput)}
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{ border: `1px solid ${COLORS.lineDark}` }}
          />
          <button
            onClick={() => enterAs(nameInput)}
            disabled={!nameInput.trim() || picksLoading}
            className="px-3 py-2 rounded-md text-sm quiniela-display uppercase tracking-wide disabled:opacity-40"
            style={{ background: COLORS.pitch, color: COLORS.chalk }}
          >
            {picksLoading ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: COLORS.pitchLight }}>
          Usa siempre el mismo nombre para ver y editar tus predicciones la próxima vez.
        </p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: COLORS.pitch }}>
        Todavía no hay partidos cargados. Pídele al organizador que los agregue en la pestaña Partidos.
      </p>
    );
  }

  // Paginación: 8 partidos por página, manteniendo el orden actual de la lista.
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const sortedMatches = [...matches].sort((a, b) => {
  // Fecha descendente
  const fa = a.fecha || '';
  const fb = b.fecha || '';

  if (fa !== fb) {
    return fb.localeCompare(fa);
  }

  // Hora ascendente
  const ha = a.hora || '';
  const hb = b.hora || '';

  return ha.localeCompare(hb);
});

const pageMatches = sortedMatches.slice(
  currentPage * PAGE_SIZE,
  currentPage * PAGE_SIZE + PAGE_SIZE
);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: COLORS.pitchDark }}>
          Jugando como <span className="font-semibold">{activeName}</span>
        </p>
        <button onClick={switchPlayer} className="text-xs underline" style={{ color: COLORS.pitchLight }}>
          Cambiar de jugador
        </button>
      </div>
      <div className="space-y-2">
        {pageMatches.map((m) => {
          const matchPlayed = m.scoreA !== null && m.scoreB !== null;
          const pick = myPicks[m.id] || { a: '', b: '' };
          const pickLocked = !!pick.locked;
          const closed = !!m.predictionsClosed;
          const locked = matchPlayed || pickLocked || closed;
          const pts = matchPoints(pick, m);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 py-2.5 px-2 rounded-md"
              style={{ borderBottom: `1px solid ${COLORS.lineDark}` }}
            >
              <div className="min-w-0">
                {(m.fase || m.fecha || m.hora) && (
                  <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: COLORS.pitchLight }}>
                    {[m.fase, formatFecha(m.fecha), m.hora].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="quiniela-display text-sm sm:text-base uppercase truncate" style={{ color: COLORS.pitchDark }}>
                  {m.teamA} <span style={{ color: COLORS.amber }}>vs</span> {m.teamB}
                </p>
                {matchPlayed ? (
                  <p className="text-[10px] mt-0.5" style={{ color: COLORS.coral }}>
                    Resultado: {m.scoreA} - {m.scoreB}
                    {pts !== null && (
                      <span className="font-semibold"> · {pts > 0 ? `+${pts}` : pts} pts</span>
                    )}
                  </p>
                ) : pickLocked ? (
                  <p className="text-[10px] mt-0.5" style={{ color: COLORS.pitchLight }}>
                    Tu predicción ya está guardada y no se puede modificar
                  </p>
                ) : closed ? (
                  <p className="text-[10px] mt-0.5" style={{ color: COLORS.coral }}>
                    Las predicciones para este partido están cerradas
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ScoreBox
                  value={pick.a ?? ''}
                  disabled={locked}
                  onChange={(v) => updatePick(m.id, 'a', v)}
                />
                <span style={{ color: COLORS.pitchDark }}>-</span>
                <ScoreBox
                  value={pick.b ?? ''}
                  disabled={locked}
                  onChange={(v) => updatePick(m.id, 'b', v)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1.5 rounded-md text-sm quiniela-display uppercase tracking-wide disabled:opacity-40"
            style={{ background: 'rgba(31,77,62,0.08)', color: COLORS.pitch }}
          >
            Anterior
          </button>
          <span className="text-xs" style={{ color: COLORS.pitchLight }}>
            Página {currentPage + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1.5 rounded-md text-sm quiniela-display uppercase tracking-wide disabled:opacity-40"
            style={{ background: 'rgba(31,77,62,0.08)', color: COLORS.pitch }}
          >
            Siguiente
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={savePicks}
          disabled={picksSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm quiniela-display uppercase tracking-wide disabled:opacity-60"
          style={{ background: COLORS.pitch, color: COLORS.chalk }}
        >
          {picksSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Guardar predicciones
        </button>
        {saved && (
          <span className="text-sm" style={{ color: COLORS.pitchLight }}>
            Guardado ✓
          </span>
        )}
      </div>
    </div>
  );
}

function TablaTab({ leaderboard, loading, matches }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: COLORS.pitch }}>
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }
  if (leaderboard.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: COLORS.pitch }}>
        Todavía no hay jugadores. Pide a tus amigos que entren en "Mis Predicciones" y guarden sus picks.
      </p>
    );
  }
  const anyPlayed = matches.some((m) => m.scoreA !== null && m.scoreB !== null);
  return (
    <div>
      {!anyPlayed && (
        <p className="text-xs text-center mb-3" style={{ color: COLORS.pitchLight }}>
          Aún no hay resultados registrados, así que todos están en 0 puntos.
        </p>
      )}
      <div className="space-y-1.5">
        {leaderboard.map((row, i) => {
          const medalColor = i === 0 ? '#FFD166' : i === 1 ? '#CBD5C0' : i === 2 ? '#E0A458' : null;
          return (
            <div
              key={row.name}
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-md"
              style={{
                background: i < 3 ? 'rgba(255,182,39,0.08)' : 'transparent',
                border: `1px solid ${COLORS.lineDark}`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="quiniela-display flex items-center justify-center rounded-full w-7 h-7 text-xs font-bold shrink-0"
                  style={{
                    background: medalColor || 'rgba(31,77,62,0.08)',
                    color: medalColor ? COLORS.pitchDark : COLORS.pitch,
                  }}
                >
                  {i + 1}
                </div>
                <p className="quiniela-display uppercase tracking-wide text-sm truncate" style={{ color: COLORS.pitchDark }}>
                  {row.name}
                </p>
                {i === 0 && row.points > 0 && <Medal size={15} style={{ color: COLORS.amber }} />}
              </div>
              <div className="text-right shrink-0">
                <p
                  className="font-bold text-lg"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.pitch }}
                >
                  {row.points} pts
                </p>
                <p className="text-[10px]" style={{ color: COLORS.pitchLight }}>
                  {row.exactos} exactos · {row.aciertos} aciertos / {row.jugados}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
