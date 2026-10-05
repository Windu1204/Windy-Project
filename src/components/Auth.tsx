import { useState, type FormEvent } from 'react';
import { UserRound, LockKeyhole, Eye, EyeOff } from 'lucide-react';
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
    return <div id="wciLogin" className="auth-page"><section className="login-hero" aria-hidden="true"/><section className="login-form-side"><form className="login-box" onSubmit={login}><div className="login-brand bni-logo" role="img" aria-label="BNI"/><h1 className="login-title">Dashboard Monitoring WCI</h1><div className="login-subtitle">Corporate, Area, dan IJR Monitoring</div><label className="login-label" htmlFor="loginEmail">Email</label><div className="login-input-wrap"><UserRound size={18}/><input className="login-input" id="loginEmail" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email akun Anda"/></div><label className="login-label" htmlFor="loginPassword">Password</label><div className="login-input-wrap"><LockKeyhole size={18}/><input className="login-input" id="loginPassword" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password"/><button className="pass-toggle" type="button" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><button className="login-btn" disabled={busy || !supabase}>{busy ? 'Menghubungkan…' : 'Login'}</button>{error && <p role="alert" className="login-error">{error}</p>}{!supabase && <p className="notice">Koneksi Supabase belum tersedia.</p>}{import.meta.env.DEV && <button type="button" className="secondary wide" onClick={onPreview}>Buka preview lokal</button>}<div className="login-divider"/><div className="login-foot">© Internal Application by Windy Olivia</div></form></section></div>;
}
