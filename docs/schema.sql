-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 31-05-2026 a las 06:08:15
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `igo_manager`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `empresa`
--

CREATE TABLE `empresa` (
  `id` int(10) UNSIGNED NOT NULL,
  `usuario_id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `sector` enum('Agropecuario','Calzado y Moda','Tecnología','Servicios','Comercio','Salud','Turismo','Educación','Otro') DEFAULT 'Otro',
  `tamano` enum('Idea inicial','Micro','Pequeña','Mediana','Grande') DEFAULT 'Micro',
  `ubicacion` varchar(120) DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `empresa`
--

INSERT INTO `empresa` (`id`, `usuario_id`, `nombre`, `sector`, `tamano`, `ubicacion`, `creado_en`) VALUES
(1, 1, 'LA vertebra', 'Tecnología', 'Micro', 'bucaramanga', '2026-05-30 20:21:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `iniciativa`
--

CREATE TABLE `iniciativa` (
  `id` int(10) UNSIGNED NOT NULL,
  `usuario_id` int(10) UNSIGNED NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `importancia` tinyint(3) UNSIGNED DEFAULT NULL CHECK (`importancia` between 1 and 10),
  `gobernabilidad` tinyint(3) UNSIGNED DEFAULT NULL CHECK (`gobernabilidad` between 1 and 10),
  `cuadrante` enum('hacer_ya','estrategico','rutina','descarte') DEFAULT NULL,
  `creado_en` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `iniciativa`
--

INSERT INTO `iniciativa` (`id`, `usuario_id`, `titulo`, `descripcion`, `importancia`, `gobernabilidad`, `cuadrante`, `creado_en`) VALUES
(1, 1, 'casa a zafi', 'xd', 10, 10, 'hacer_ya', '2026-05-30 20:22:01'),
(2, 1, 'cdcd', NULL, 4, 4, 'descarte', '2026-05-30 20:22:27'),
(3, 1, 'acadadadad', 'adad', 6, 6, 'descarte', '2026-05-30 20:22:52'),
(4, 1, 'adsf', NULL, 10, 10, 'hacer_ya', '2026-05-30 20:29:32');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tarea`
--

CREATE TABLE `tarea` (
  `id` int(10) UNSIGNED NOT NULL,
  `iniciativa_id` int(10) UNSIGNED NOT NULL,
  `descripcion` text NOT NULL,
  `fecha_limite` date DEFAULT NULL,
  `presupuesto` decimal(12,2) DEFAULT NULL,
  `responsable` varchar(120) DEFAULT NULL,
  `estado` enum('Pendiente','En proceso','Terminado','Abortado') NOT NULL DEFAULT 'Pendiente',
  `creado_en` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `correo` varchar(191) NOT NULL,
  `contrasena_hash` varchar(255) NOT NULL,
  `rango_edad` enum('18-25','26-35','36-45','46-55','56+') DEFAULT NULL,
  `genero` enum('Masculino','Femenino','Otro') DEFAULT NULL,
  `rol` enum('usuario','admin') NOT NULL DEFAULT 'usuario',
  `acepta_habeas` tinyint(1) NOT NULL DEFAULT 0,
  `creado_en` datetime NOT NULL DEFAULT current_timestamp(),
  `es_premium` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`id`, `nombre`, `correo`, `contrasena_hash`, `rango_edad`, `genero`, `rol`, `acepta_habeas`, `creado_en`, `es_premium`) VALUES
(1, 'Nikolas esteban vesga ramirez', 'nikolasvesga@gmail.com', '$2a$10$ugic/H2Ip0erLVglIW2e4OXhwkumN/c3Of01X/V1UV2sBFRAfcNZW', '18-25', 'Masculino', 'usuario', 1, '2026-05-30 20:20:29', 0);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `empresa`
--
ALTER TABLE `empresa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `iniciativa`
--
ALTER TABLE `iniciativa`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `tarea`
--
ALTER TABLE `tarea`
  ADD PRIMARY KEY (`id`),
  ADD KEY `iniciativa_id` (`iniciativa_id`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `correo` (`correo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `empresa`
--
ALTER TABLE `empresa`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `iniciativa`
--
ALTER TABLE `iniciativa`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `tarea`
--
ALTER TABLE `tarea`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `empresa`
--
ALTER TABLE `empresa`
  ADD CONSTRAINT `empresa_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `iniciativa`
--
ALTER TABLE `iniciativa`
  ADD CONSTRAINT `iniciativa_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `tarea`
--
ALTER TABLE `tarea`
  ADD CONSTRAINT `tarea_ibfk_1` FOREIGN KEY (`iniciativa_id`) REFERENCES `iniciativa` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
