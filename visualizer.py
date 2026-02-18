#!/usr/bin/env python3
"""
Disco Ball Club Light Show Visualizer
Single-file preview + MP4 export tool.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import random
import shutil
import subprocess
import sys
import time
import tkinter as tk
from dataclasses import asdict, dataclass
from tkinter import filedialog, messagebox
from typing import Dict, List, Tuple

REQUIRED_PYTHON_PACKAGES = ["pygame", "numpy", "librosa"]
missing = [pkg for pkg in REQUIRED_PYTHON_PACKAGES if importlib.util.find_spec(pkg) is None]
if missing:
    print("\n[ERROR] Missing Python packages:", ", ".join(missing))
    print("Install with:")
    print("  pip install pygame numpy librosa imageio-ffmpeg")
    print("Then rerun this command.\n")
    sys.exit(1)

import librosa
import numpy as np
import pygame

WIDTH, HEIGHT = 1920, 1080
FPS = 60
DEFAULT_BG_PATH = "/mnt/data/dancefloor_daimyo_bg_upscaled_1920x1080.png"


@dataclass
class Config:
    origin_x: float = 0.18
    origin_y: float = 0.18
    intensity_master: float = 1.0

    haze_strength: float = 0.22

    ray_count: int = 240
    ray_length: float = 1.25
    ray_rotation_speed: float = 0.22
    ray_thickness: int = 2
    ray_shimmer: float = 0.65
    ray_brightness: float = 1.0

    gobo_strength: float = 0.38
    gobo_speed: float = 0.35

    laser_count: int = 4
    laser_speed: float = 0.55
    laser_thickness: int = 18
    laser_brightness: float = 1.0

    floor_pulse_strength: float = 0.80
    floor_sweep_strength: float = 0.68

    sparkle_density: float = 1.0
    sparkle_size: float = 1.0

    # Tuning note: thresholded bloom. Raise bloom_threshold for less glow.
    bloom_strength: float = 0.62
    bloom_threshold: int = 168

    strobe_strength: float = 0.80
    strobe_cooldown: float = 1.3

    drop_mode_sensitivity: float = 1.4
    drop_mode_duration: float = 6.0

    # Tuning note: crowd band controls where crowd shimmer and sparkle bias happen.
    crowd_y0: float = 0.72
    crowd_y1: float = 0.90
    crowd_shimmer_strength: float = 0.16

    palette_warm: Tuple[int, int, int] = (255, 165, 60)
    palette_magenta: Tuple[int, int, int] = (255, 30, 190)
    palette_blue: Tuple[int, int, int] = (80, 170, 255)


def print_startup_guide() -> None:
    print("\n=== Disco Ball Club Light Show Visualizer ===")
    print("EASIEST WAY:")
    print("  Just run: python visualizer.py")
    print("  (This opens a simple window so you can pick files and start preview/export.)")
    print("HOW TO RUN (copy/paste):")
    print('  Preview: python visualizer.py --audio "song.wav" --hud')
    print('  Export : python visualizer.py --audio "song.wav" --out "visualizer.mp4"')
    print("\nKeyboard controls in preview:")
    print("  [ / ] intensity | - / + bloom | 1/2 rays | 3/4 lasers | 5/6 sparkles")
    print("  O/P origin X | K/L origin Y | S save last_preset.json | H toggle HUD")
    print("  ESC or close window to quit preview\n")


def parse_origin(origin: str) -> Tuple[float, float]:
    x_str, y_str = origin.split(",")
    x, y = float(x_str), float(y_str)
    return max(0.0, min(1.0, x)), max(0.0, min(1.0, y))


def load_and_fit_background(path: str) -> pygame.Surface:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Background image not found: {path}")

    # Crash fix note: this function uses convert(), which requires display mode set.
    img = pygame.image.load(path).convert()
    src_w, src_h = img.get_size()
    src_ratio = src_w / src_h
    target_ratio = WIDTH / HEIGHT

    if abs(src_ratio - target_ratio) < 1e-4:
        return pygame.transform.smoothscale(img, (WIDTH, HEIGHT))

    if src_ratio > target_ratio:
        new_w = int(src_h * target_ratio)
        x0 = (src_w - new_w) // 2
        crop = img.subsurface((x0, 0, new_w, src_h))
    else:
        new_h = int(src_w / target_ratio)
        y0 = (src_h - new_h) // 2
        crop = img.subsurface((0, y0, src_w, new_h))

    return pygame.transform.smoothscale(crop, (WIDTH, HEIGHT))


def smooth_series(x: np.ndarray, alpha: float = 0.2) -> np.ndarray:
    y = np.zeros_like(x)
    if len(x) == 0:
        return y
    y[0] = x[0]
    for i in range(1, len(x)):
        y[i] = alpha * x[i] + (1.0 - alpha) * y[i - 1]
    return y


def normalize(x: np.ndarray, p99_floor: float = 1e-6) -> np.ndarray:
    x = np.maximum(0.0, x)
    p = max(np.percentile(x, 99), p99_floor)
    return np.clip(x / p, 0.0, 1.5)


def analyze_audio(audio_path: str, fps: int, duration_limit: float | None) -> Dict[str, np.ndarray | float]:
    y, sr = librosa.load(audio_path, sr=44100, mono=True)
    if duration_limit is not None:
        y = y[: int(duration_limit * sr)]

    hop = max(256, int(sr / fps))
    n_fft = 4096
    spec = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop, window="hann"))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    def band_energy(low: float, high: float) -> np.ndarray:
        mask = (freqs >= low) & (freqs < high)
        if not np.any(mask):
            return np.zeros(spec.shape[1], dtype=np.float32)
        return np.mean(spec[mask, :], axis=0)

    bass = band_energy(20, 150)
    mids = band_energy(150, 2000)
    highs = band_energy(2000, 10000)

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop, center=True)[0]
    peak_frames = librosa.util.frame(np.pad(np.abs(y), (0, hop)), frame_length=hop, hop_length=hop)
    peak = peak_frames.max(axis=0)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)

    min_len = min(len(bass), len(mids), len(highs), len(rms), len(peak), len(onset_env))
    bass = bass[:min_len]
    mids = mids[:min_len]
    highs = highs[:min_len]
    rms = rms[:min_len]
    peak = peak[:min_len]
    onset_env = onset_env[:min_len]

    bass = smooth_series(normalize(bass), 0.25)
    mids = smooth_series(normalize(mids), 0.20)
    highs = smooth_series(normalize(highs), 0.18)
    rms = smooth_series(normalize(rms), 0.25)
    peak = smooth_series(normalize(peak), 0.20)
    onset_env = smooth_series(normalize(onset_env), 0.15)

    energy = 0.45 * bass + 0.35 * mids + 0.20 * highs
    d_energy = np.diff(np.r_[energy[0], energy])

    strobe = (onset_env > 0.66) & (d_energy > 0.03)
    drop_raw = (smooth_series(energy, 0.08) > np.percentile(energy, 78)) & (d_energy > 0.015)

    return {
        "bass": bass,
        "mids": mids,
        "highs": highs,
        "rms": rms,
        "peak": peak,
        "onset": onset_env,
        "strobe": strobe.astype(np.float32),
        "drop_raw": drop_raw.astype(np.float32),
        "frames": min_len,
        "duration": min_len / fps,
    }


def make_haze_noise(seed: int = 7, w: int = 320, h: int = 180) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = rng.random((h, w), dtype=np.float32)
    n = (n + np.roll(n, 2, axis=0) + np.roll(n, 3, axis=1)) / 3.0
    return n


def tinted_circle(radius: int, color: Tuple[int, int, int], alpha: int) -> pygame.Surface:
    size = radius * 2
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    for r in range(radius, 0, -1):
        a = int(alpha * (r / radius) ** 2)
        pygame.draw.circle(surf, (*color, a), (radius, radius), r)
    return surf


def blend_color(a: Tuple[int, int, int], b: Tuple[int, int, int], c: Tuple[int, int, int], wa: float, wb: float, wc: float) -> Tuple[int, int, int]:
    s = max(1e-6, wa + wb + wc)
    wa, wb, wc = wa / s, wb / s, wc / s
    return (
        int(a[0] * wa + b[0] * wb + c[0] * wc),
        int(a[1] * wa + b[1] * wb + c[1] * wc),
        int(a[2] * wa + b[2] * wb + c[2] * wc),
    )


class Sparkle:
    __slots__ = ("x", "y", "vx", "vy", "life", "ttl", "size", "color")

    def __init__(self, x, y, vx, vy, ttl, size, color):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.life = ttl
        self.ttl = ttl
        self.size = size
        self.color = color


class DiscoVisualizer:
    def __init__(self, config: Config, features: Dict[str, np.ndarray | float], seed: int, hud: bool):
        self.cfg = config
        self.f = features
        self.seed = seed
        self.rng = random.Random(seed)
        self.hud = hud

        self.sparkles: List[Sparkle] = []
        self.last_strobe_t = -99.0
        self.strobe_frames_left = 0
        self.drop_until = -1.0
        self.last_drop_t = -99.0

        self.haze_noise = make_haze_noise(seed)
        self.crowd_noise = make_haze_noise(seed + 101, 512, 96)

        self.light_surface = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        self.tmp_surface = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        self.font = pygame.font.SysFont("consolas", 24)

        self.dynamic_warm = self.cfg.palette_warm
        self.dynamic_magenta = self.cfg.palette_magenta
        self.dynamic_blue = self.cfg.palette_blue

    def feature_at(self, idx: int, key: str) -> float:
        arr = self.f[key]
        if idx < 0:
            return float(arr[0])
        if idx >= len(arr):
            return float(arr[-1])
        return float(arr[idx])

    def update_dynamic_palette(self, energy: float, drop_mul: float):
        warm_w = max(0.05, 1.15 - energy)
        mag_w = 0.35 + 0.75 * energy
        blue_w = 0.18 + 0.52 * energy
        if drop_mul > 1.0:
            mag_w += 0.65
            blue_w += 0.65
            warm_w *= 0.65

        self.dynamic_warm = blend_color(self.cfg.palette_warm, self.cfg.palette_magenta, self.cfg.palette_blue, warm_w, mag_w * 0.25, blue_w * 0.1)
        self.dynamic_magenta = blend_color(self.cfg.palette_warm, self.cfg.palette_magenta, self.cfg.palette_blue, warm_w * 0.20, mag_w, blue_w * 0.40)
        self.dynamic_blue = blend_color(self.cfg.palette_warm, self.cfg.palette_magenta, self.cfg.palette_blue, warm_w * 0.08, mag_w * 0.35, blue_w)

    def spawn_sparkles(self, highs: float):
        spawn = int((2 + highs * 18) * self.cfg.sparkle_density)
        crowd_y0 = self.cfg.crowd_y0 * HEIGHT
        crowd_y1 = self.cfg.crowd_y1 * HEIGHT

        for _ in range(spawn):
            if self.rng.random() > 0.34:
                continue

            x = self.rng.uniform(WIDTH * 0.05, WIDTH * 0.95)
            if self.rng.random() < 0.66:
                y = self.rng.uniform(crowd_y0, crowd_y1)
            else:
                y = self.rng.uniform(HEIGHT * 0.08, HEIGHT * 0.94)

            drift = self.rng.uniform(20, 80)
            angle = self.rng.uniform(-1.0, 1.0)
            vx = math.cos(angle) * drift * 0.2
            vy = -drift
            ttl = self.rng.uniform(0.18, 0.7)
            size = self.cfg.sparkle_size * self.rng.uniform(1.0, 2.8)
            color = self.dynamic_magenta if self.rng.random() < 0.60 else self.dynamic_warm
            self.sparkles.append(Sparkle(x, y, vx, vy, ttl, size, color))

    def update_sparkles(self, dt: float):
        alive = []
        for p in self.sparkles:
            p.life -= dt
            if p.life <= 0:
                continue
            p.x += p.vx * dt
            p.y += p.vy * dt
            if 0 <= p.x < WIDTH and 0 <= p.y < HEIGHT:
                alive.append(p)
        self.sparkles = alive

    def draw_haze(self, t: float, energy: float):
        self.tmp_surface.fill((0, 0, 0, 0))
        low = np.roll(self.haze_noise, int(t * 18) % self.haze_noise.shape[1], axis=1)
        low = np.roll(low, int(t * 9) % self.haze_noise.shape[0], axis=0)

        haze = ((low * 85) + 20).astype(np.uint8)
        rgb = np.stack(
            [
                haze,
                np.clip(haze * 0.60 + 20, 0, 255).astype(np.uint8),
                np.clip(haze * 0.85 + 40, 0, 255).astype(np.uint8),
            ],
            axis=2,
        )
        surf = pygame.surfarray.make_surface(np.transpose(rgb, (1, 0, 2)))
        surf = pygame.transform.smoothscale(surf, (WIDTH, HEIGHT))
        alpha = int(np.clip((35 + energy * 55) * self.cfg.haze_strength, 0, 120))
        self.tmp_surface.blit(surf, (0, 0))
        self.tmp_surface.set_alpha(alpha)
        self.light_surface.blit(self.tmp_surface, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)

    def draw_rays(self, t: float, mids: float, highs: float, drop_mul: float, origin_norm: Tuple[float, float]):
        origin = (int(origin_norm[0] * WIDTH), int(origin_norm[1] * HEIGHT))
        base_rot = t * self.cfg.ray_rotation_speed * math.tau
        ray_count = int(self.cfg.ray_count * (1.15 if drop_mul > 1.0 else 1.0))
        glint_angle = (t * 1.3) % math.tau

        for i in range(ray_count):
            frac = i / max(1, ray_count)
            angle = frac * math.tau + base_rot
            tile_mod = 0.55 + 0.45 * math.sin(58.0 * angle + t * 6.2)
            shimmer = 0.78 + self.cfg.ray_shimmer * 0.22 * math.sin((i * 0.9) + t * 12.0)
            glint = 1.0 + 1.35 * math.exp(-((math.atan2(math.sin(angle - glint_angle), math.cos(angle - glint_angle))) ** 2) / 0.03)
            bright = (
                self.cfg.ray_brightness
                * self.cfg.intensity_master
                * (0.2 + 0.7 * mids + 0.55 * highs)
                * tile_mod
                * shimmer
                * glint
                * drop_mul
            )
            if bright < 0.08:
                continue

            length = int(WIDTH * self.cfg.ray_length * (0.55 + 0.45 * tile_mod))
            x2 = int(origin[0] + math.cos(angle) * length)
            y2 = int(origin[1] + math.sin(angle) * length)
            base = self.dynamic_warm if (i % 7) < 4 else self.dynamic_magenta
            color = tuple(min(255, int(ch * min(1.6, bright))) for ch in base)
            alpha = min(240, int(44 + bright * 90))
            for k in range(3):
                w = max(1, self.cfg.ray_thickness - k)
                pygame.draw.line(self.light_surface, (*color, max(15, alpha // (k + 1))), origin, (x2, y2), w)

    def draw_gobo(self, t: float, mids: float):
        strength = self.cfg.gobo_strength * mids * self.cfg.intensity_master
        if strength < 0.05:
            return

        spacing = 140
        ox = int((math.sin(t * self.cfg.gobo_speed) * 0.5 + 0.5) * spacing)
        oy = int((math.cos(t * self.cfg.gobo_speed * 1.3) * 0.5 + 0.5) * spacing)
        col = (*self.dynamic_blue, int(min(110, 40 + strength * 70)))

        for y in range(oy, HEIGHT, spacing):
            for x in range(ox, WIDTH, spacing):
                rad = int(6 + 6 * strength)
                pygame.draw.circle(self.light_surface, col, (x, y), rad)

        for i in range(12):
            px = int((i / 12) * WIDTH)
            py = int((0.58 + 0.08 * math.sin(t * 0.8 + i)) * HEIGHT)
            pygame.draw.line(self.light_surface, (*self.dynamic_magenta, int(35 + 55 * strength)), (px, py), (px + 60, py + 20), 2)

    def draw_lasers(self, t: float, bass: float, drop_mul: float):
        count = self.cfg.laser_count
        sweep = t * self.cfg.laser_speed * math.tau
        thickness = int(self.cfg.laser_thickness * (0.7 + bass * 1.2))
        bright = self.cfg.laser_brightness * self.cfg.intensity_master * (0.25 + bass * 1.2) * drop_mul

        for i in range(count):
            phase = i * math.tau / max(1, count)
            y1 = int((0.15 + 0.7 * ((math.sin(sweep + phase) + 1.0) * 0.5)) * HEIGHT)
            y2 = int((0.15 + 0.7 * ((math.sin(sweep + phase + 1.7) + 1.0) * 0.5)) * HEIGHT)
            c = self.dynamic_blue if i % 2 == 0 else self.dynamic_magenta
            alpha = int(min(220, 50 + bright * 80))
            for k in range(3):
                w = max(1, thickness - k * 6)
                pygame.draw.line(self.light_surface, (*c, max(12, alpha // (k + 1))), (0, y1 + k), (WIDTH, y2 - k), w)

    def draw_floor_pulse(self, bass: float, rms: float):
        s = (bass * 0.8 + rms * 0.6) * self.cfg.floor_pulse_strength * self.cfg.intensity_master
        if s < 0.03:
            return

        color = self.dynamic_warm
        radius_x = int(WIDTH * (0.45 + 0.15 * s))
        radius_y = int(120 + 160 * s)
        center = (WIDTH // 2, int(HEIGHT * 0.96))

        ellipse = pygame.Surface((radius_x * 2, radius_y * 2), pygame.SRCALPHA)
        for i in range(14, 0, -1):
            a = int((30 + 95 * s) * (i / 14))
            pygame.draw.ellipse(
                ellipse,
                (*color, a),
                (radius_x * (1 - i / 14), radius_y * (1 - i / 14), radius_x * 2 * i / 14, radius_y * 2 * i / 14),
            )
        self.light_surface.blit(ellipse, (center[0] - radius_x, center[1] - radius_y), special_flags=pygame.BLEND_RGBA_ADD)

    def draw_floor_sweep(self, t: float, energy: float, bass: float):
        strength = self.cfg.floor_sweep_strength * self.cfg.intensity_master * (0.18 + 0.85 * energy + 0.6 * bass)
        if strength < 0.08:
            return

        sweep = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        base_alpha = int(min(120, 18 + strength * 62))
        progress = (t * (0.20 + 0.7 * energy)) % 1.0
        center_x = int(-WIDTH * 0.25 + progress * WIDTH * 1.5)
        floor_top = int(HEIGHT * 0.70)

        for i in range(9):
            fade = 1.0 - i / 10.0
            y0 = floor_top + i * 42
            y1 = min(HEIGHT, y0 + 72)
            x0 = center_x - 460 + i * 60
            x1 = center_x + 460 + i * 80
            poly = [(x0, y0), (x1, y0 + 28), (x1 + 140, y1), (x0 - 140, y1)]
            color = (*self.dynamic_blue, int(base_alpha * fade))
            pygame.draw.polygon(sweep, color, poly)

        sweep = pygame.transform.smoothscale(pygame.transform.smoothscale(sweep, (WIDTH // 2, HEIGHT // 2)), (WIDTH, HEIGHT))
        self.light_surface.blit(sweep, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)

    def draw_crowd_shimmer(self, t: float, mids: float, highs: float):
        crowd_y0 = int(self.cfg.crowd_y0 * HEIGHT)
        crowd_y1 = int(self.cfg.crowd_y1 * HEIGHT)
        if crowd_y1 <= crowd_y0:
            return

        shimmer_strength = self.cfg.crowd_shimmer_strength * self.cfg.intensity_master * (0.15 + 0.7 * mids + 0.55 * highs)
        if shimmer_strength < 0.03:
            return

        noise = np.roll(self.crowd_noise, int(t * 28) % self.crowd_noise.shape[1], axis=1)
        noise = np.roll(noise, int(t * 11) % self.crowd_noise.shape[0], axis=0)

        h = max(4, crowd_y1 - crowd_y0)
        row_idx = np.linspace(0, noise.shape[0] - 1, h).astype(int)
        band = noise[row_idx]
        lum = np.clip((band * 255.0 - 175.0) * 1.6, 0, 255).astype(np.uint8)

        # subtle, non-blocky glitter lines in crowd area
        rgb = np.stack(
            [
                (lum * 0.6).astype(np.uint8),
                (lum * 0.35).astype(np.uint8),
                lum,
            ],
            axis=2,
        )
        surf = pygame.surfarray.make_surface(np.transpose(rgb, (1, 0, 2)))
        surf = pygame.transform.smoothscale(surf, (WIDTH, h))
        surf.set_alpha(int(min(88, 24 + shimmer_strength * 95)))
        self.light_surface.blit(surf, (0, crowd_y0), special_flags=pygame.BLEND_RGBA_ADD)

    def draw_sparkles(self):
        for p in self.sparkles:
            n = p.life / p.ttl
            alpha = int(200 * n)
            size = int(max(1, p.size * (0.4 + 0.8 * (1.0 - n))))
            color = (*p.color, alpha)
            pygame.draw.circle(self.light_surface, color, (int(p.x), int(p.y)), size)
            pygame.draw.line(self.light_surface, color, (int(p.x - size * 2), int(p.y)), (int(p.x + size * 2), int(p.y)), 1)
            pygame.draw.line(self.light_surface, color, (int(p.x), int(p.y - size * 2)), (int(p.x), int(p.y + size * 2)), 1)

    def draw_lens_effects(self, peak: float, origin_norm: Tuple[float, float]):
        if peak < 0.86:
            return

        c = self.dynamic_warm
        origin = np.array([origin_norm[0] * WIDTH, origin_norm[1] * HEIGHT], dtype=np.float32)
        center = np.array([WIDTH * 0.5, HEIGHT * 0.5], dtype=np.float32)
        v = center - origin
        for mul, rad in [(0.4, 34), (0.8, 56), (1.2, 28)]:
            p = origin + v * mul
            ghost = tinted_circle(rad, c, int(18 + peak * 42))
            self.light_surface.blit(ghost, (int(p[0] - rad), int(p[1] - rad)), special_flags=pygame.BLEND_RGBA_ADD)

    def bloom_surface(self, src: pygame.Surface) -> pygame.Surface:
        # Thresholded bloom: only bright pixels are extracted and blurred.
        if self.cfg.bloom_strength <= 0.01:
            return src

        arr = pygame.surfarray.array3d(src).astype(np.float32)
        lum = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]
        mask = np.clip((lum - float(self.cfg.bloom_threshold)) / max(1.0, 255.0 - self.cfg.bloom_threshold), 0.0, 1.0)
        if float(mask.max()) < 0.01:
            return src

        bright_arr = (arr * mask[:, :, None]).astype(np.uint8)
        bright = pygame.surfarray.make_surface(bright_arr)
        w2, h2 = WIDTH // 4, HEIGHT // 4
        blur = pygame.transform.smoothscale(bright, (w2, h2))
        blur = pygame.transform.smoothscale(blur, (WIDTH, HEIGHT))

        out = src.copy()
        blur.set_alpha(int(220 * min(1.5, self.cfg.bloom_strength)))
        out.blit(blur, (0, 0), special_flags=pygame.BLEND_RGB_ADD)
        return out

    def maybe_trigger_modes(self, frame_i: int, t: float):
        strobe_flag = self.feature_at(frame_i, "strobe") > 0.5
        onset = self.feature_at(frame_i, "onset")
        if strobe_flag and (t - self.last_strobe_t > self.cfg.strobe_cooldown):
            self.strobe_frames_left = self.rng.randint(2, 4)
            self.last_strobe_t = t

        drop_raw = self.feature_at(frame_i, "drop_raw")
        if drop_raw > 0.5 and onset > self.cfg.drop_mode_sensitivity * 0.5 and (t - self.last_drop_t > 12.0):
            self.drop_until = t + self.cfg.drop_mode_duration
            self.last_drop_t = t

    def draw_hud(self, screen: pygame.Surface, frame_i: int):
        if not self.hud:
            return
        lines = [
            f"Frame {frame_i}",
            f"Intensity {self.cfg.intensity_master:.2f}",
            f"Bloom {self.cfg.bloom_strength:.2f} thr:{self.cfg.bloom_threshold}",
            f"Rays {self.cfg.ray_brightness:.2f}",
            f"Lasers {self.cfg.laser_brightness:.2f}",
            f"Sparkles {self.cfg.sparkle_density:.2f}",
            f"Origin ({self.cfg.origin_x:.3f}, {self.cfg.origin_y:.3f})",
            f"Crowd y [{self.cfg.crowd_y0:.2f}, {self.cfg.crowd_y1:.2f}]",
        ]
        y = 20
        for line in lines:
            surf = self.font.render(line, True, (255, 245, 235))
            screen.blit(surf, (20, y))
            y += 26

    def rgb_split_if_needed(self, frame: np.ndarray, peak: float) -> np.ndarray:
        if peak < 0.92:
            return frame
        offset = int(1 + (peak - 0.92) * 18)
        r = np.roll(frame[:, :, 0], offset, axis=1)
        g = frame[:, :, 1]
        b = np.roll(frame[:, :, 2], -offset, axis=0)
        mixed = np.stack([r, g, b], axis=2)
        return np.clip(0.65 * frame + 0.35 * mixed, 0, 255).astype(np.uint8)

    def render_frame(self, bg: pygame.Surface, frame_i: int, dt: float) -> pygame.Surface:
        t = frame_i / FPS
        bass = self.feature_at(frame_i, "bass")
        mids = self.feature_at(frame_i, "mids")
        highs = self.feature_at(frame_i, "highs")
        rms = self.feature_at(frame_i, "rms")
        peak = self.feature_at(frame_i, "peak")
        energy = np.clip(0.4 * bass + 0.4 * mids + 0.2 * highs, 0, 1.5)

        self.maybe_trigger_modes(frame_i, t)
        drop_mul = 1.35 if t < self.drop_until else 1.0
        self.update_dynamic_palette(energy, drop_mul)

        # Realism upgrade: local origin wobble tied to highs. Base cfg origin stays unchanged.
        wobble_amp = 0.001 + 0.003 * highs
        wobble_x = wobble_amp * math.sin(t * 2.5 + highs * 5.0)
        wobble_y = wobble_amp * math.cos(t * 2.1 + highs * 4.2)
        origin_norm = (
            max(0.0, min(1.0, self.cfg.origin_x + wobble_x)),
            max(0.0, min(1.0, self.cfg.origin_y + wobble_y)),
        )

        self.spawn_sparkles(highs)
        self.update_sparkles(dt)

        self.light_surface.fill((0, 0, 0, 0))
        self.draw_haze(t, energy)
        self.draw_rays(t, mids, highs, drop_mul, origin_norm)
        self.draw_gobo(t, mids)
        self.draw_lasers(t, bass, drop_mul)
        self.draw_floor_pulse(bass, rms)
        self.draw_floor_sweep(t, energy, bass)
        self.draw_crowd_shimmer(t, mids, highs)
        self.draw_sparkles()
        self.draw_lens_effects(peak, origin_norm)

        lights = self.bloom_surface(self.light_surface)
        out = bg.copy()
        out.blit(lights, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)

        if self.strobe_frames_left > 0:
            flash = int(255 * self.cfg.strobe_strength)
            strobe = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            strobe.fill((flash, flash, flash, 120))
            out.blit(strobe, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)
            self.strobe_frames_left -= 1

        return out


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def print_param(name: str, value: float):
    print(f"{name}: {value:.3f}")


def save_preset(path: str, cfg: Config):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(asdict(cfg), f, indent=2)
    print(f"Preset saved to {path}")


def load_preset(path: str, cfg: Config):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for k, v in data.items():
        if hasattr(cfg, k):
            default = getattr(cfg, k)
            setattr(cfg, k, tuple(v) if isinstance(default, tuple) else v)
    print(f"Loaded preset from {path}")


def handle_key(event_key, cfg: Config, vis: DiscoVisualizer):
    delta = 0.05
    moved = False
    if event_key == pygame.K_LEFTBRACKET:
        cfg.intensity_master = clamp(cfg.intensity_master - delta, 0.2, 2.2)
        print_param("intensity_master", cfg.intensity_master)
    elif event_key == pygame.K_RIGHTBRACKET:
        cfg.intensity_master = clamp(cfg.intensity_master + delta, 0.2, 2.2)
        print_param("intensity_master", cfg.intensity_master)
    elif event_key in (pygame.K_MINUS, pygame.K_KP_MINUS):
        cfg.bloom_strength = clamp(cfg.bloom_strength - delta, 0.0, 1.5)
        print_param("bloom_strength", cfg.bloom_strength)
    elif event_key in (pygame.K_EQUALS, pygame.K_PLUS, pygame.K_KP_PLUS):
        cfg.bloom_strength = clamp(cfg.bloom_strength + delta, 0.0, 1.5)
        print_param("bloom_strength", cfg.bloom_strength)
    elif event_key == pygame.K_1:
        cfg.ray_brightness = clamp(cfg.ray_brightness - delta, 0.0, 2.0)
        print_param("ray_brightness", cfg.ray_brightness)
    elif event_key == pygame.K_2:
        cfg.ray_brightness = clamp(cfg.ray_brightness + delta, 0.0, 2.0)
        print_param("ray_brightness", cfg.ray_brightness)
    elif event_key == pygame.K_3:
        cfg.laser_brightness = clamp(cfg.laser_brightness - delta, 0.0, 2.4)
        print_param("laser_brightness", cfg.laser_brightness)
    elif event_key == pygame.K_4:
        cfg.laser_brightness = clamp(cfg.laser_brightness + delta, 0.0, 2.4)
        print_param("laser_brightness", cfg.laser_brightness)
    elif event_key == pygame.K_5:
        cfg.sparkle_density = clamp(cfg.sparkle_density - delta, 0.1, 3.0)
        print_param("sparkle_density", cfg.sparkle_density)
    elif event_key == pygame.K_6:
        cfg.sparkle_density = clamp(cfg.sparkle_density + delta, 0.1, 3.0)
        print_param("sparkle_density", cfg.sparkle_density)
    elif event_key == pygame.K_o:
        cfg.origin_x = clamp(cfg.origin_x - 0.01, 0.0, 1.0)
        moved = True
    elif event_key == pygame.K_p:
        cfg.origin_x = clamp(cfg.origin_x + 0.01, 0.0, 1.0)
        moved = True
    elif event_key == pygame.K_k:
        cfg.origin_y = clamp(cfg.origin_y - 0.01, 0.0, 1.0)
        moved = True
    elif event_key == pygame.K_l:
        cfg.origin_y = clamp(cfg.origin_y + 0.01, 0.0, 1.0)
        moved = True
    elif event_key == pygame.K_s:
        save_preset("last_preset.json", cfg)
    elif event_key == pygame.K_h:
        vis.hud = not vis.hud
        print(f"HUD: {'ON' if vis.hud else 'OFF'}")

    if moved:
        print(f"origin: ({cfg.origin_x:.3f}, {cfg.origin_y:.3f})")


def run_preview(bg: pygame.Surface, audio_path: str, vis: DiscoVisualizer, total_frames: int):
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Disco Ball Club Light Show")
    clock = pygame.time.Clock()

    pygame.mixer.init(frequency=44100)
    pygame.mixer.music.load(audio_path)
    pygame.mixer.music.play()
    start = time.perf_counter()

    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0
        elapsed = time.perf_counter() - start
        frame_i = min(total_frames - 1, int(elapsed * FPS))

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                else:
                    handle_key(event.key, vis.cfg, vis)

        frame = vis.render_frame(bg, frame_i, dt)
        vis.draw_hud(frame, frame_i)
        screen.blit(frame, (0, 0))
        pygame.display.flip()

        if not pygame.mixer.music.get_busy() and frame_i >= total_frames - 2:
            running = False


def ffmpeg_installed() -> bool:
    return shutil.which("ffmpeg") is not None


def export_mp4(bg: pygame.Surface, audio_path: str, out_path: str, vis: DiscoVisualizer, total_frames: int):
    if not ffmpeg_installed():
        print("\n[WARNING] ffmpeg is not installed. Cannot export MP4 yet.")
        print("Install ffmpeg and rerun export:")
        print("  Ubuntu/Debian: sudo apt install ffmpeg")
        print("  macOS (brew):  brew install ffmpeg")
        print("  Windows (choco): choco install ffmpeg")
        print("Preview mode still works with: python visualizer.py --audio \"song.wav\" --hud\n")
        return

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        audio_path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "320k",
        "-shortest",
        out_path,
    ]

    print(f"Exporting to {out_path} ({total_frames} frames)...")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    try:
        for i in range(total_frames):
            frame = vis.render_frame(bg, i, 1.0 / FPS)
            arr = pygame.surfarray.array3d(frame)
            arr = np.transpose(arr, (1, 0, 2)).astype(np.uint8)
            arr = vis.rgb_split_if_needed(arr, vis.feature_at(i, "peak"))
            proc.stdin.write(arr.tobytes())
            if i % (FPS * 2) == 0:
                print(f"  {100.0 * i / max(1, total_frames):5.1f}%")
    finally:
        if proc.stdin:
            proc.stdin.close()
        proc.wait()

    if proc.returncode == 0:
        print(f"Done! MP4 created: {out_path}")
    else:
        print("ffmpeg failed. Please verify your audio file/codec and ffmpeg installation.")


def build_parser() -> argparse.ArgumentParser:
    epilog = (
        'Examples:\n'
        '  python visualizer.py --audio "song.wav" --hud\n'
        '  python visualizer.py --audio "song.wav" --out "visualizer.mp4"\n'
        '  python visualizer.py --audio "song.mp3" --duration 30 --seed 7 --origin "0.18,0.18"\n'
    )
    parser = argparse.ArgumentParser(
        description="Disco ball nightclub visualizer preview + MP4 exporter.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=epilog,
    )
    parser.add_argument("--audio", help="Path to input audio (.wav/.mp3/etc.)")
    parser.add_argument("--out", help="Output MP4 path. If omitted, opens preview window.")
    parser.add_argument("--duration", type=float, help="Render duration in seconds (default: full audio).")
    parser.add_argument("--seed", type=int, default=7, help="Random seed for deterministic visuals.")
    parser.add_argument("--origin", default="0.18,0.18", help='Disco origin normalized coords: "x,y" in 0..1')
    parser.add_argument("--preset", help="Load settings from JSON preset file.")
    parser.add_argument("--save-preset", dest="save_preset", help="Save current settings to JSON and exit.")
    parser.add_argument("--hud", action="store_true", help="Show on-screen HUD meters/settings.")
    parser.add_argument("--bg", default=DEFAULT_BG_PATH, help=f"Background image path (default: {DEFAULT_BG_PATH})")
    parser.add_argument("--ui", action="store_true", help="Open a simple window UI to run without command-line options.")
    return parser


def launch_ui() -> argparse.Namespace | None:
    try:
        root = tk.Tk()
    except tk.TclError:
        print("[ERROR] Could not open UI window (no display available).")
        print('Run with CLI instead, for example: python visualizer.py --audio "song.wav" --hud')
        return None

    root.title("Disco Ball Visualizer Launcher")
    root.geometry("700x430")
    root.resizable(False, False)

    values = {
        "audio": tk.StringVar(),
        "out": tk.StringVar(),
        "duration": tk.StringVar(),
        "seed": tk.StringVar(value="7"),
        "origin": tk.StringVar(value="0.18,0.18"),
        "preset": tk.StringVar(),
        "save_preset": tk.StringVar(),
        "bg": tk.StringVar(value=DEFAULT_BG_PATH),
        "hud": tk.BooleanVar(value=True),
    }
    mode = {"run": None}

    def browse_file(var_name: str, title: str, filetypes):
        path = filedialog.askopenfilename(title=title, filetypes=filetypes)
        if path:
            values[var_name].set(path)

    def browse_save(var_name: str, title: str, default_ext: str):
        path = filedialog.asksaveasfilename(title=title, defaultextension=default_ext)
        if path:
            values[var_name].set(path)

    def row(label, key, y, browse_cb=None, browse_text="Browse"):
        tk.Label(root, text=label, anchor="w").place(x=20, y=y, width=145)
        tk.Entry(root, textvariable=values[key]).place(x=170, y=y, width=430)
        if browse_cb:
            tk.Button(root, text=browse_text, command=browse_cb).place(x=610, y=y - 1, width=75)

    row("Audio file*", "audio", 30, lambda: browse_file("audio", "Select audio", [("Audio", "*.wav *.mp3 *.flac *.ogg *.m4a"), ("All", "*.*")]))
    row("Background", "bg", 70, lambda: browse_file("bg", "Select background image", [("Image", "*.png *.jpg *.jpeg *.bmp"), ("All", "*.*")]))
    row("Output MP4", "out", 110, lambda: browse_save("out", "Save output video", ".mp4"), "Save As")
    row("Duration (sec)", "duration", 150)
    row("Seed", "seed", 190)
    row("Origin x,y", "origin", 230)
    row("Load preset", "preset", 270, lambda: browse_file("preset", "Load preset JSON", [("JSON", "*.json"), ("All", "*.*")]))
    row("Save preset", "save_preset", 310, lambda: browse_save("save_preset", "Save preset JSON", ".json"), "Save As")

    tk.Checkbutton(root, text="Show HUD", variable=values["hud"]).place(x=170, y=345)

    def validate_and_close(chosen_mode: str):
        if not values["audio"].get().strip():
            messagebox.showerror("Missing audio", "Please select an audio file.")
            return
        mode["run"] = chosen_mode
        root.destroy()

    tk.Button(root, text="Start Preview", command=lambda: validate_and_close("preview"), bg="#1d7f31", fg="white").place(x=170, y=380, width=180)
    tk.Button(root, text="Export MP4", command=lambda: validate_and_close("export"), bg="#8a2be2", fg="white").place(x=360, y=380, width=180)
    tk.Button(root, text="Cancel", command=root.destroy).place(x=550, y=380, width=135)

    tk.Label(root, text="Tip: Leave Output MP4 empty for preview-only. For Export MP4, output path is recommended.", anchor="w").place(x=20, y=5, width=660)

    root.mainloop()

    if mode["run"] is None:
        return None

    out_path = values["out"].get().strip()
    if mode["run"] == "preview":
        out_path = ""

    return argparse.Namespace(
        audio=values["audio"].get().strip(),
        out=out_path or None,
        duration=float(values["duration"].get().strip()) if values["duration"].get().strip() else None,
        seed=int(values["seed"].get().strip() or 7),
        origin=values["origin"].get().strip() or "0.18,0.18",
        preset=values["preset"].get().strip() or None,
        save_preset=values["save_preset"].get().strip() or None,
        hud=bool(values["hud"].get()),
        bg=values["bg"].get().strip() or DEFAULT_BG_PATH,
        ui=True,
    )


def ensure_display_for_surface_convert():
    # Crash fix: convert() needs display mode in both preview and export paths.
    try:
        pygame.display.set_mode((1, 1), flags=pygame.HIDDEN)
    except Exception:
        pygame.display.set_mode((1, 1))


def main():
    print_startup_guide()
    parser = build_parser()
    args = parser.parse_args()

    if args.ui or len(sys.argv) == 1:
        print("Opening launcher UI...")
        ui_args = launch_ui()
        if ui_args is None:
            if not args.audio:
                print("No run selected. Exiting.")
                return
        else:
            args = ui_args

    if not args.audio:
        parser.error("the following arguments are required: --audio (or run with --ui / no args to use launcher window)")

    if not os.path.exists(args.audio):
        print(f"[ERROR] Audio file not found: {args.audio}")
        sys.exit(1)

    cfg = Config()
    ox, oy = parse_origin(args.origin)
    cfg.origin_x, cfg.origin_y = ox, oy

    if args.preset:
        if not os.path.exists(args.preset):
            print(f"[ERROR] Preset file not found: {args.preset}")
            sys.exit(1)
        load_preset(args.preset, cfg)

    pygame.init()
    ensure_display_for_surface_convert()

    try:
        bg = load_and_fit_background(args.bg)
    except Exception as exc:
        print(f"[ERROR] Could not load background: {exc}")
        pygame.quit()
        sys.exit(1)

    print("Analyzing audio (offline deterministic pass)...")
    features = analyze_audio(args.audio, FPS, args.duration)
    total_frames = int(features["frames"])
    vis = DiscoVisualizer(cfg, features, args.seed, args.hud)

    if args.save_preset:
        save_preset(args.save_preset, cfg)

    ran_successfully = False
    try:
        if args.out:
            export_mp4(bg, args.audio, args.out, vis, total_frames)
        else:
            run_preview(bg, args.audio, vis, total_frames)
        ran_successfully = True
    finally:
        # Auto-save on normal run exit so user tweaks are preserved.
        if ran_successfully:
            try:
                save_preset("last_preset.json", cfg)
            except Exception as exc:
                print(f"[WARNING] Could not auto-save last_preset.json: {exc}")
        pygame.quit()


if __name__ == "__main__":
    main()
