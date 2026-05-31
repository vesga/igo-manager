require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_cambiar_en_produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/views/index.html'));
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/perfil'));
app.use('/', require('./routes/app'));
app.use('/', require('./routes/iniciativas'));
app.use('/', require('./routes/resumen'));   // ← Resumen ejecutivo IA

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  IGO Manager corriendo en http://localhost:${PORT}`);
});
