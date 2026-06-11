-- docs/schema.sql
-- Esquema completo de la base de datos IGO Manager.
-- Ejecutar en MySQL antes del Sprint 1.
-- Cada tabla incluye comentarios para que el equipo entienda el modelo.

CREATE DATABASE IF NOT EXISTS igo_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE igo_manager;

-- ── Tabla: usuario ────────────────────────────────────────────────────────────
-- Almacena los datos de cada emprendedor registrado.
CREATE TABLE IF NOT EXISTS usuario (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(120)        NOT NULL,
  correo           VARCHAR(191)        NOT NULL UNIQUE,
  contrasena_hash  VARCHAR(255)        NOT NULL,           -- bcrypt hash
  rango_edad       ENUM('18-25','26-35','36-45','46-55','56+') DEFAULT NULL,
  genero           ENUM('Masculino','Femenino','Otro')         DEFAULT NULL,
  rol              ENUM('usuario','admin') NOT NULL DEFAULT 'usuario',
  acepta_habeas    TINYINT(1)          NOT NULL DEFAULT 0,  -- 1 = aceptó
  creado_en        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabla: empresa ────────────────────────────────────────────────────────────
-- Una empresa por usuario (relación 1:1 via usuario_id UNIQUE).
CREATE TABLE IF NOT EXISTS empresa (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NOT NULL UNIQUE,               -- 1 empresa por usuario
  nombre      VARCHAR(200)  NOT NULL,
  sector      ENUM(
    'Agropecuario','Calzado y Moda','Tecnología',
    'Servicios','Comercio','Salud','Turismo','Educación','Otro'
  ) DEFAULT 'Otro',
  tamano      ENUM('Idea inicial','Micro','Pequeña','Mediana','Grande') DEFAULT 'Micro',
  ubicacion   VARCHAR(120)  DEFAULT NULL,                 -- ciudad
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
);

-- ── Tabla: iniciativa ─────────────────────────────────────────────────────────
-- Cada necesidad/iniciativa que el emprendedor quiere priorizar.
-- importancia y gobernabilidad: valores 1-10 asignados manualmente por el usuario.
-- cuadrante: se calcula en el backend y se guarda aquí para consultas rápidas.
CREATE TABLE IF NOT EXISTS iniciativa (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED  NOT NULL,
  titulo          VARCHAR(200)  NOT NULL,
  descripcion     TEXT          DEFAULT NULL,
  importancia     TINYINT UNSIGNED DEFAULT NULL CHECK (importancia BETWEEN 1 AND 10),
  gobernabilidad  TINYINT UNSIGNED DEFAULT NULL CHECK (gobernabilidad BETWEEN 1 AND 10),
  -- Cuadrante calculado: 'hacer_ya' | 'estrategico' | 'rutina' | 'descarte' | NULL
  cuadrante       ENUM('hacer_ya','estrategico','rutina','descarte') DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
);

-- ── Tabla: tarea ──────────────────────────────────────────────────────────────
-- Plan de acción: tareas generadas a partir de iniciativas (Sprint 3).
CREATE TABLE IF NOT EXISTS tarea (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iniciativa_id INT UNSIGNED  NOT NULL,
  descripcion   TEXT          NOT NULL,
  fecha_limite  DATE          DEFAULT NULL,
  presupuesto   DECIMAL(12,2) DEFAULT NULL,               -- opcional
  responsable   VARCHAR(120)  DEFAULT NULL,
  estado        ENUM('Pendiente','En proceso','Terminado','Abortado')
                              NOT NULL DEFAULT 'Pendiente',
  creado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (iniciativa_id) REFERENCES iniciativa(id) ON DELETE CASCADE
);

-- ── Migración Sprint 2.1: columna premium en usuario ─────────────────────────
-- Ejecutar si ya tienes la BD creada del Sprint 1.
-- Si estás creando la BD desde cero, ya está incluida en la tabla usuario.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS es_premium TINYINT(1) NOT NULL DEFAULT 0;

-- ── Migración: historial de diagnósticos ──────────────────────────────────────
-- Guarda una "foto" del estado de todas las iniciativas cada vez que el usuario
-- guarda una calificación. Permite ver la evolución del negocio en el tiempo.
CREATE TABLE IF NOT EXISTS historial_diagnostico (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NOT NULL,
  -- JSON con el snapshot: [{titulo, importancia, gobernabilidad, cuadrante}]
  snapshot    JSON         NOT NULL,
  promedio_i  DECIMAL(4,2) NOT NULL,
  promedio_g  DECIMAL(4,2) NOT NULL,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
);

-- ── Migración: tabla de temas ─────────────────────────────────────────────────
-- Un tema agrupa iniciativas relacionadas (ej: "Marketing", "Operaciones").
-- Toda iniciativa debe pertenecer a un tema.
CREATE TABLE IF NOT EXISTS tema (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED  NOT NULL,
  nombre      VARCHAR(150)  NOT NULL,
  descripcion VARCHAR(300)  DEFAULT NULL,
  color       VARCHAR(7)    DEFAULT '#7c6dfa',  -- color hex para identificarlo visualmente
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
);

-- Añadir tema_id a iniciativa (obligatorio)
ALTER TABLE iniciativa
  ADD COLUMN IF NOT EXISTS tema_id INT UNSIGNED DEFAULT NULL,
  ADD CONSTRAINT fk_iniciativa_tema
    FOREIGN KEY (tema_id) REFERENCES tema(id) ON DELETE SET NULL;

-- ── Migración: solicitudes de pago premium ───────────────────────────────────
-- Guarda cada solicitud de acceso premium con su comprobante y estado.
CREATE TABLE IF NOT EXISTS solicitud_premium (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED  NOT NULL,
  nombre          VARCHAR(200)  NOT NULL,
  correo          VARCHAR(200)  NOT NULL,
  metodo_pago     ENUM('Nequi','Transferencia','Otro') NOT NULL,
  comprobante_url VARCHAR(500)  DEFAULT NULL,  -- ruta del archivo subido
  estado          ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  codigo_enviado  VARCHAR(50)   DEFAULT NULL,  -- código premium que se generó
  notas           VARCHAR(500)  DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
);
