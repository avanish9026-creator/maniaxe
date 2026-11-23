import { useState } from "react";
import { Button, Field, Icon, IconButton, Notice } from "../lib/ui";
import { useTheme } from "../lib/theme";

export default function Login({ onGoogle, onEmail, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dark, toggleTheme] = useTheme();
  const logo = import.meta.env.BASE_URL + "trakey-logo.png";
  return (
    <div className="login">
      <div className="login-art">
        <div className="brand"><img src={logo} alt="" /><div><b style={{ fontSize: 20 }}>Trakey Admin</b></div></div>
        <div>
          <h2>Run Trakey from <em>one calm place.</em></h2>
          <p>See every user, approve payments, and message anyone in two taps.</p>
          <div className="login-points">
            <div><Icon name="users" /> A card for every user, with all their controls</div>
            <div><Icon name="send" /> Push notifications and email, one person or everyone</div>
            <div><Icon name="card" /> Payments, gifts and tax downloads</div>
          </div>
        </div>
        <small className="muted">Authorized administrators only.</small>
      </div>
      <div className="login-form">
        <IconButton className="bordered" icon={dark ? "sun" : "moon"} label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme} style={{ position: "absolute", top: 20, right: 20 }} />
        <div className="login-box">
          <img src={logo} alt="" style={{ width: 52, height: 52, borderRadius: 15 }} />
          <h1>Welcome back</h1>
          <p className="sub">Sign in to the Trakey admin portal.</p>
          <Button className="google-btn" size="lg" disabled={loading} onClick={onGoogle}>Continue with Google</Button>
          <div className="or">OR</div>
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); onEmail(email, password); }}>
            <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" autoComplete="username" /></Field>
            <Field label="Password"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" /></Field>
            <Button type="submit" variant="primary" size="lg" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
          </form>
          {error && <Notice tone="bad">{error}</Notice>}
        </div>
      </div>
    </div>
  );
}
