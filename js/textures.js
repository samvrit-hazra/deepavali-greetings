import * as THREE from 'three';

function canvasTexture(renderer, width, height, draw, { srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

export function makeHaloTexture(renderer) {
  return canvasTexture(renderer, 256, 256, (ctx, w, h) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, 'rgba(255, 252, 242, 1)');
    g.addColorStop(0.06, 'rgba(255, 243, 210, 0.96)');
    g.addColorStop(0.14, 'rgba(255, 214, 148, 0.72)');
    g.addColorStop(0.28, 'rgba(255, 174, 82, 0.34)');
    g.addColorStop(0.48, 'rgba(255, 130, 38, 0.11)');
    g.addColorStop(0.7, 'rgba(255, 100, 18, 0.025)');
    g.addColorStop(1.0, 'rgba(255, 90, 10, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeSparkTexture(renderer) {
  return canvasTexture(renderer, 64, 64, (ctx, w, h) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.22, 'rgba(255, 246, 220, 0.94)');
    g.addColorStop(0.5, 'rgba(255, 196, 108, 0.34)');
    g.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeStreakTexture(renderer) {
  return canvasTexture(renderer, 512, 64, (ctx, w, h) => {
    const horizontal = ctx.createLinearGradient(0, 0, w, 0);
    horizontal.addColorStop(0, 'rgba(255, 220, 170, 0)');
    horizontal.addColorStop(0.22, 'rgba(255, 226, 180, 0.12)');
    horizontal.addColorStop(0.43, 'rgba(255, 242, 214, 0.7)');
    horizontal.addColorStop(0.5, 'rgba(255, 255, 245, 1)');
    horizontal.addColorStop(0.57, 'rgba(255, 238, 200, 0.7)');
    horizontal.addColorStop(0.78, 'rgba(255, 218, 160, 0.12)');
    horizontal.addColorStop(1, 'rgba(255, 210, 150, 0)');
    ctx.fillStyle = horizontal;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-in';
    const vertical = ctx.createLinearGradient(0, 0, 0, h);
    vertical.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vertical.addColorStop(0.4, 'rgba(0, 0, 0, 0.6)');
    vertical.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
    vertical.addColorStop(0.6, 'rgba(0, 0, 0, 0.6)');
    vertical.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makePetalTexture(renderer) {
  return canvasTexture(renderer, 256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);

    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(-116, 0);
      ctx.bezierCurveTo(-72, -40, -22, -53, 22, -39);
      ctx.bezierCurveTo(62, -26, 98, -16, 118, 0);
      ctx.bezierCurveTo(98, 16, 62, 26, 22, 39);
      ctx.bezierCurveTo(-22, 53, -72, 40, -116, 0);
      ctx.closePath();
    };

    const g = ctx.createRadialGradient(-26, 0, 4, 0, 0, 130);
    g.addColorStop(0, '#ffd978');
    g.addColorStop(0.42, '#ffb03a');
    g.addColorStop(0.78, '#f1841b');
    g.addColorStop(1, '#cf5a0d');
    shape();
    ctx.fillStyle = g;
    ctx.fill();

    ctx.globalCompositeOperation = 'source-atop';

    // ruffle shading along the top and bottom
    const shade = ctx.createLinearGradient(0, -56, 0, 56);
    shade.addColorStop(0, 'rgba(120, 42, 4, 0.42)');
    shade.addColorStop(0.26, 'rgba(255, 200, 92, 0.05)');
    shade.addColorStop(0.6, 'rgba(255, 226, 150, 0.2)');
    shade.addColorStop(1, 'rgba(119, 38, 2, 0.34)');
    ctx.fillStyle = shade;
    ctx.fillRect(-w, -h, w * 2, h * 2);

    // veins
    ctx.strokeStyle = 'rgba(255, 236, 180, 0.34)';
    ctx.lineWidth = 1.2;
    for (let i = -5; i <= 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-108, i * 1.5);
      ctx.bezierCurveTo(-40, i * 5.5, 48, i * 6.5, 114, i * 2.2);
      ctx.stroke();
    }

    // central crease
    ctx.strokeStyle = 'rgba(151, 58, 6, 0.3)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.lineTo(116, 0);
    ctx.stroke();

    // tip warmth
    const tip = ctx.createRadialGradient(100, 0, 0, 100, 0, 42);
    tip.addColorStop(0, 'rgba(255, 240, 178, 0.5)');
    tip.addColorStop(1, 'rgba(255, 240, 178, 0)');
    ctx.fillStyle = tip;
    ctx.fillRect(-w, -h, w * 2, h * 2);

    ctx.restore();
  });
}

export function makeClayTexture(renderer) {
  return canvasTexture(renderer, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8d472d';
    ctx.fillRect(0, 0, w, h);

    // broad tonal mottling
    for (let i = 0; i < 34; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 26 + Math.random() * 95;
      const light = Math.random() > 0.52;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (light) {
        g.addColorStop(0, 'rgba(214, 142, 98, 0.12)');
        g.addColorStop(1, 'rgba(214, 142, 98, 0)');
      } else {
        g.addColorStop(0, 'rgba(48, 17, 8, 0.16)');
        g.addColorStop(1, 'rgba(48, 17, 8, 0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // wheel-thrown rings
    for (let y = 0; y < h; y += 4 + Math.random() * 8) {
      ctx.beginPath();
      const wobble = Math.random() * 4;
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x * 0.021 + wobble) * 1.6 + Math.sin(x * 0.083) * 0.6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = `rgba(38, 13, 5, ${0.018 + Math.random() * 0.05})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.2;
      ctx.stroke();
    }

    // light throwing ridges
    for (let y = 4; y < h; y += 10 + Math.random() * 16) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        const yy = y + Math.sin(x * 0.019) * 2;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = 'rgba(235, 170, 122, 0.04)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // speckles and grog
    for (let i = 0; i < 6200; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const a = Math.random() * 0.11;
      ctx.fillStyle = Math.random() > 0.58
        ? `rgba(28, 10, 4, ${a})`
        : `rgba(226, 166, 120, ${a * 0.7})`;
      const s = Math.random() > 0.94 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
    }

    // a few dark finger-smudge streaks
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + 24, y + 6,
        x + 46, y - 5,
        x + 80 + Math.random() * 40, y + 3,
      );
      ctx.strokeStyle = `rgba(42, 14, 5, ${0.03 + Math.random() * 0.05})`;
      ctx.lineWidth = 2 + Math.random() * 5;
      ctx.stroke();
    }

    // slightly sun-warmed crown
    const crown = ctx.createLinearGradient(0, 0, 0, h);
    crown.addColorStop(0, 'rgba(255, 190, 128, 0.05)');
    crown.addColorStop(0.4, 'rgba(255, 190, 128, 0)');
    crown.addColorStop(1, 'rgba(40, 12, 4, 0.08)');
    ctx.fillStyle = crown;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeBumpTexture(renderer) {
  return canvasTexture(renderer, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i += 1) {
      const v = 96 + Math.random() * 96;
      ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.15 + Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    for (let y = 0; y < h; y += 5 + Math.random() * 8) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const yy = y + Math.sin(x * 0.04) * 1.5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = `rgba(210, 210, 210, ${0.03 + Math.random() * 0.05})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, { srgb: false });
}

export function makeRangoliTexture(renderer) {
  return canvasTexture(renderer, 1024, 1024, (ctx, w, h) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.translate(c, c);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const stroke = (alpha, width) => {
      ctx.strokeStyle = `rgba(255, 210, 132, ${alpha})`;
      ctx.lineWidth = width;
    };

    const glowStroke = (width) => {
      stroke(0.06, width * 5);
      ctx.stroke();
      stroke(0.18, width * 2.1);
      ctx.stroke();
      stroke(0.62, width);
      ctx.stroke();
    };

    const wobblyCircle = (r, alpha = 1) => {
      ctx.beginPath();
      const steps = 180;
      for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        const rr = r + Math.sin(a * 7 + r) * 1.6 + Math.sin(a * 13) * 0.8;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      glowStroke(1.3);
    };

    // three rippling rings
    [162, 318, 474].forEach((r, i) => {
      wobblyCircle(r, 0.8 - i * 0.1);
    });

    // eight large lotus petals
    for (let i = 0; i < 8; i += 1) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -168);
      ctx.bezierCurveTo(94, -214, 124, -334, 0, -468);
      ctx.bezierCurveTo(-124, -334, -94, -214, 0, -168);
      glowStroke(1.5);
      ctx.restore();
    }

    // eight offset inner petals
    for (let i = 0; i < 8; i += 1) {
      ctx.save();
      ctx.rotate(((i + 0.5) / 8) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -186);
      ctx.bezierCurveTo(58, -232, 58, -300, 0, -348);
      ctx.bezierCurveTo(-58, -300, -58, -232, 0, -186);
      glowStroke(1.15);
      ctx.restore();
    }

    // sixteen small arcs in the outer field
    for (let i = 0; i < 16; i += 1) {
      ctx.save();
      ctx.rotate((i / 16) * Math.PI * 2);
      ctx.beginPath();
      ctx.arc(0, -412, 24, Math.PI * 0.18, Math.PI * 0.82);
      glowStroke(1.05);
      ctx.beginPath();
      ctx.arc(0, -348, 14, Math.PI * 0.1, Math.PI * 1.9);
      glowStroke(0.9);
      ctx.restore();
    }

    // dot constellations
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      const r = i % 2 === 0 ? 372 : 438;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 220, 158, 0.55)';
      ctx.fill();
    }

    // spokes
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 178, Math.sin(a) * 178);
      ctx.lineTo(Math.cos(a) * 294, Math.sin(a) * 294);
      stroke(0.15, 0.8);
      ctx.stroke();
    }

    // soft inner halo
    const halo = ctx.createRadialGradient(0, 0, 60, 0, 0, 510);
    halo.addColorStop(0, 'rgba(255, 196, 110, 0.1)');
    halo.addColorStop(0.5, 'rgba(255, 168, 70, 0.03)');
    halo.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-c, -c, w, w);

    // radial falloff on the whole drawing
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 512);
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(0.36, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(0.72, 'rgba(0, 0, 0, 0.6)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(-c, -c, w, w);
  });
}

export function makeRingTexture(renderer) {
  return canvasTexture(renderer, 256, 256, (ctx, w, h) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, h);
    // layered soft concentric strokes build a feathered ring
    for (let i = 0; i < 22; i += 1) {
      const spread = (i - 11) * 1.7;
      const alpha = 0.06 * (1 - Math.abs(i - 11) / 12);
      ctx.beginPath();
      ctx.arc(c, c, c * 0.78 + spread, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 226, 170, ${Math.max(0, alpha)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c, c, c * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 240, 205, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });
}
