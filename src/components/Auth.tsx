import { useState, type FormEvent } from 'react';
import { LockKeyhole, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
export function Auth({ onPreview }: {
    onPreview: () => void;
}) {
    const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [show, setShow] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    async function login(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
        if (!supabase)
            throw new Error('Hubungkan Supabase untuk mengaktifkan login.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
            throw error;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Login gagal.');
    }
    finally {
        setBusy(false);
    } }
    return <div className="auth-page"><div className="auth-hero"><div className="brand-word"><span>◈</span> BNI</div><div><p className="eyebrow">TRANSACTION BANKING SERVICES</p><h1>Every request.<br />A clearer picture.</h1><p>Corporate, Area, dan IJR Monitoring</p><div className="hero-line"/></div><small>Connected monitoring · Shared progress</small></div><main className="auth-form"><div className="login-icon"><LockKeyhole /></div><p className="eyebrow">WORKSPACE MONITORING</p><h2>Selamat datang</h2><p className="muted">Masuk untuk memantau implementasi dan kinerja SLA.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email akun Anda"/></label><label>Password<div className="password"><input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/><button type="button" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary wide" disabled={busy || !supabase}>{busy ? 'Menghubungkan…' : 'Masuk'}<ArrowRight size={18}/></button></form>{!supabase && <p className="notice">Koneksi Supabase belum tersedia. Akun dan data bersama akan aktif setelah konfigurasi backend selesai.</p>}{import.meta.env.DEV && <button className="secondary wide" onClick={onPreview}>Buka preview lokal</button>}<small className="muted">Akses diberikan oleh administrator workspace.</small></main></div>;
}
