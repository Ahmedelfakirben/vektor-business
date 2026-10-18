-- Migration: Add visual signature column for non-AI instant camera recognition in POS
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS image_signature TEXT;
