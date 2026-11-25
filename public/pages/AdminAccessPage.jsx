export default function AdminAccessPage({ status, error, loginError, busy, onRetry, onSubmit }) {
  return (
    <section className="admin-access-page page-shell" aria-labelledby="admin-access-title">
      <div className="admin-access-card">
        <img className="dialog-mark" src="/brand/mark.svg" alt="" width="36" height="36" />
        <div className="eyebrow"><span className="eyebrow-dash" /> ACCESO RESTRINGIDO</div>
        {status === 'checking' ? (
          <div role="status" aria-live="polite"><h1 id="admin-access-title">Verificando acceso.</h1><p>Un momento, estamos comprobando la sesión administrativa.</p></div>
        ) : status === 'error' ? (
          <div role="alert"><h1 id="admin-access-title">Panel no disponible.</h1><p>{error}</p><button className="button button-primary form-submit" type="button" onClick={onRetry}>Intentar de nuevo</button></div>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 id="admin-access-title">Bienvenido de vuelta.</h1>
            <p>Inicia sesión para administrar el catálogo y sus referencias de precio.</p>
            <label className="field-label" htmlFor="login-email">Correo electrónico</label>
            <input className="text-input" id="login-email" name="email" type="email" autoComplete="username" required />
            <label className="field-label" htmlFor="login-password">Contraseña</label>
            <input className="text-input" id="login-password" name="password" type="password" autoComplete="current-password" required />
            {loginError && <p className="form-error" role="alert">{loginError}</p>}
            <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? 'Comprobando…' : 'Iniciar sesión'} <span aria-hidden="true">→</span></button>
          </form>
        )}
      </div>
    </section>
  );
}