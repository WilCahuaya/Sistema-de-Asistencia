-- ============================================
-- MIGRACIÓN: Agregar rol 'director' al enum rol_type
-- ============================================

-- Agregar 'director' al enum existente
ALTER TYPE rol_type ADD VALUE IF NOT EXISTS 'director';

-- Nota: PostgreSQL no permite eliminar valores de un ENUM, pero podemos agregar nuevos valores
-- El orden de los valores en el ENUM no afecta la funcionalidad

