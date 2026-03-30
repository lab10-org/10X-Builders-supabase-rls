import './style.css'
import { supabase } from './supabase.js'

const app = document.querySelector('#app')

let session = null

async function init() {
  const { data } = await supabase.auth.getSession()
  session = data.session
  render()
}

supabase.auth.onAuthStateChange((_event, newSession) => {
  session = newSession
  render()
})

function render() {
  if (session) {
    renderDashboard()
  } else {
    renderAuth()
  }
}

// ─── Auth form ───────────────────────────────────────────

function renderAuth() {
  app.innerHTML = `
    <h1>Supabase &mdash; Usuarios</h1>
    <div id="msg"></div>
    <div class="card">
      <h2>Crear cuenta</h2>
      <form id="signup-form">
        <div class="form-group">
          <label for="su-name">Nombre completo</label>
          <input id="su-name" type="text" placeholder="Tu nombre" />
        </div>
        <div class="form-group">
          <label for="su-email">Email</label>
          <input id="su-email" type="email" placeholder="user@example.com" required />
        </div>
        <div class="form-group">
          <label for="su-pass">Contraseña</label>
          <input id="su-pass" type="password" minlength="6" placeholder="mínimo 6 caracteres" required />
        </div>
        <div class="btn-row">
          <button type="submit" class="btn-primary">Registrarse</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h2>Iniciar sesión</h2>
      <form id="signin-form">
        <div class="form-group">
          <label for="si-email">Email</label>
          <input id="si-email" type="email" placeholder="user@example.com" required />
        </div>
        <div class="form-group">
          <label for="si-pass">Contraseña</label>
          <input id="si-pass" type="password" minlength="6" required />
        </div>
        <div class="btn-row">
          <button type="submit" class="btn-primary">Entrar</button>
        </div>
      </form>
    </div>
  `

  document.querySelector('#signup-form').addEventListener('submit', handleSignUp)
  document.querySelector('#signin-form').addEventListener('submit', handleSignIn)
}

async function handleSignUp(e) {
  e.preventDefault()
  clearMsg()
  const name = document.querySelector('#su-name').value.trim()
  const email = document.querySelector('#su-email').value.trim()
  const password = document.querySelector('#su-pass').value

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) return showMsg(error.message, 'error')
  showMsg('Cuenta creada. Sesión iniciada.', 'success')
}

async function handleSignIn(e) {
  e.preventDefault()
  clearMsg()
  const email = document.querySelector('#si-email').value.trim()
  const password = document.querySelector('#si-pass').value

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return showMsg(error.message, 'error')
}

// ─── Dashboard ───────────────────────────────────────────

async function renderDashboard() {
  const userEmail = session.user.email

  app.innerHTML = `
    <h1>Supabase &mdash; Usuarios</h1>
    <div class="session-bar">
      <span>Sesión: <strong>${userEmail}</strong></span>
      <button class="btn-danger" id="logout-btn">Salir</button>
    </div>
    <div id="msg"></div>
    <div class="card">
      <h2>Usuarios registrados</h2>
      <div id="profiles-table"><p class="empty">Cargando…</p></div>
    </div>
  `

  document.querySelector('#logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
  })

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  const container = document.querySelector('#profiles-table')

  if (error) {
    container.innerHTML = `<p class="empty">Error: ${error.message}</p>`
    return
  }

  if (!profiles.length) {
    container.innerHTML = '<p class="empty">No hay usuarios todavía.</p>'
    return
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Email</th><th>Nombre</th><th>Creado</th></tr>
      </thead>
      <tbody>
        ${profiles
          .map(
            (p) => `
          <tr>
            <td>${esc(p.email)}</td>
            <td>${esc(p.full_name || '—')}</td>
            <td>${new Date(p.created_at).toLocaleString()}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

// ─── Helpers ─────────────────────────────────────────────

function showMsg(text, type) {
  const el = document.querySelector('#msg')
  if (el) el.innerHTML = `<div class="message ${type}">${esc(text)}</div>`
}

function clearMsg() {
  const el = document.querySelector('#msg')
  if (el) el.innerHTML = ''
}

function esc(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

init()
