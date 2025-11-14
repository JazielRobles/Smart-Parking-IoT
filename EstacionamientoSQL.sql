-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: estacionamiento
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cajones`
--

DROP TABLE IF EXISTS `cajones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cajones` (
  `id_cajon` int NOT NULL AUTO_INCREMENT,
  `numero_cajon` varchar(50) NOT NULL,
  `disponible` tinyint(1) NOT NULL DEFAULT '1',
  `nivel` int NOT NULL DEFAULT '1',
  `tipo_cajon` enum('automovil','discapacitado','electrico','motocicleta') NOT NULL DEFAULT 'automovil',
  `tarifa_hora` float NOT NULL,
  `descripcion` text,
  PRIMARY KEY (`id_cajon`),
  UNIQUE KEY `numero_cajon` (`numero_cajon`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cajones`
--

LOCK TABLES `cajones` WRITE;
/*!40000 ALTER TABLE `cajones` DISABLE KEYS */;
INSERT INTO `cajones` VALUES (1,'A-01',1,1,'automovil',20,'Cerca de la entrada principal'),(2,'A-02',1,1,'automovil',20,'Techado'),(3,'B-15',1,2,'electrico',25,'Incluye cargador tipo 2'),(4,'C-30',1,3,'motocicleta',10,'Espacio exclusivo para motos'),(5,'D-05',1,1,'discapacitado',20,'Amplio y cerca del elevador');
/*!40000 ALTER TABLE `cajones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tarjetas`
--

DROP TABLE IF EXISTS `tarjetas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarjetas` (
  `id_tarjeta` int NOT NULL AUTO_INCREMENT,
  `uid_tarjeta` varchar(255) NOT NULL,
  `saldo` float NOT NULL DEFAULT '0',
  `estado` enum('activa','inactiva','reportada') NOT NULL DEFAULT 'inactiva',
  `fecha_emision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_tarjeta`),
  UNIQUE KEY `uid_tarjeta` (`uid_tarjeta`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tarjetas`
--

LOCK TABLES `tarjetas` WRITE;
/*!40000 ALTER TABLE `tarjetas` DISABLE KEYS */;
INSERT INTO `tarjetas` VALUES (1,'118-199-180-5',500,'activa','2023-01-15 00:00:00'),(2,'11-22-33-44',1200,'activa','2022-11-20 00:00:00');
/*!40000 ALTER TABLE `tarjetas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido_paterno` varchar(100) NOT NULL,
  `apellido_materno` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `correo` varchar(255) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `rol` enum('cliente','administrador') NOT NULL DEFAULT 'cliente',
  `id_tarjeta` int DEFAULT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `correo` (`correo`),
  UNIQUE KEY `id_tarjeta` (`id_tarjeta`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_tarjeta`) REFERENCES `tarjetas` (`id_tarjeta`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Admin','Principal','Del Sistema','5512345678','admin@estacionamiento.com','admin_pass_123','administrador',NULL,'2025-10-06 18:58:23',1),(2,'Ana','García','López','5587654321','ana.garcia@email.com','cliente_pass_abc','cliente',1,'2025-10-06 18:58:23',1),(3,'Carlos','Martínez','Rodríguez','5511223344','carlos.martinez@email.com','cliente_pass_def','cliente',2,'2025-10-06 18:58:23',1),(4,'Sofía','Hernández','Pérez','5555667788','sofia.hernandez@email.com','cliente_pass_ghi','cliente',NULL,'2025-10-06 18:58:23',1),(5,'Luis','Ramírez','Gómez','5544332211','luis.supervisor@estacionamiento.com','admin_pass_456','administrador',NULL,'2025-10-06 18:58:23',1);
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehiculos`
--

DROP TABLE IF EXISTS `vehiculos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehiculos` (
  `id_vehiculo` int NOT NULL AUTO_INCREMENT,
  `placa` varchar(20) NOT NULL,
  `marca` varchar(100) NOT NULL,
  `modelo` varchar(100) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `tipo_vehiculo` enum('automovil','motocicleta','discapacitado','electrico') NOT NULL DEFAULT 'automovil',
  `descripcion` text,
  `id_usuario` int NOT NULL,
  `permiso_acceso` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `placa` (`placa`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `vehiculos_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehiculos`
--

LOCK TABLES `vehiculos` WRITE;
/*!40000 ALTER TABLE `vehiculos` DISABLE KEYS */;
INSERT INTO `vehiculos` VALUES (1,'ABC-123-DE','Nissan','Versa','Gris','automovil',NULL,2,1),(2,'XYZ-789-FG','Honda','CBR600','Rojo','motocicleta',NULL,3,1),(3,'LMN-456-HI','Chevrolet','Aveo','Blanco','automovil',NULL,4,1),(4,'PQR-321-JK','Tesla','Model 3','Azul','electrico',NULL,2,1),(5,'DEF-654-LM','Ford','Lobo','Negro','automovil',NULL,3,1);
/*!40000 ALTER TABLE `vehiculos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transacciones`
--

DROP TABLE IF EXISTS `transacciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transacciones` (
  `id_transaccion` int NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int NOT NULL,
  `id_cajon` int NOT NULL,
  `hora_entrada` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `hora_salida` datetime DEFAULT NULL,
  `total` float DEFAULT NULL,
  `tiempo_estacionado_min` int DEFAULT NULL,
  `metodo_pago` varchar(50) DEFAULT 'tarjeta_rfid',
  `estado_pago` enum('pendiente','pagado','cancelado','saldo_insuficiente') NOT NULL DEFAULT 'pendiente',
  `id_tarjeta_pago` int DEFAULT NULL,
  PRIMARY KEY (`id_transaccion`),
  KEY `id_vehiculo` (`id_vehiculo`),
  KEY `id_cajon` (`id_cajon`),
  KEY `id_tarjeta_pago` (`id_tarjeta_pago`),
  CONSTRAINT `transacciones_ibfk_1` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE RESTRICT,
  CONSTRAINT `transacciones_ibfk_2` FOREIGN KEY (`id_cajon`) REFERENCES `cajones` (`id_cajon`) ON DELETE RESTRICT,
  CONSTRAINT `transacciones_ibfk_3` FOREIGN KEY (`id_tarjeta_pago`) REFERENCES `tarjetas` (`id_tarjeta`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-11 20:00:00