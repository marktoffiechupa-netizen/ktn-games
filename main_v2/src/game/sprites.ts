// Cute character drawing on canvas. Both characters are simple, expressive top-down chibi figures.
import type { Player } from './types';

export function drawBoy(
  ctx: CanvasRenderingContext2D,
  p: Player,
  time: number,
  isHuman: boolean
) {
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  // facing rotation
  const angle = Math.atan2(p.facing.y, p.facing.x);
  // bobbing
  const bobY = p.isMoving ? Math.sin(time * 0.012 + p.bob) * 1.5 : 0;
  ctx.translate(0, bobY);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius - 2, p.radius * 0.9, p.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle + Math.PI / 2); // face up by default (so 'right' facing = top)

  // hit flash
  if (p.hitFlash > 0) {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 30;
  }

  // body (blue shirt)
  const r = p.radius;
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.ellipse(0, 4, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // shirt detail
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.ellipse(0, 4, r * 0.45, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // head (skin)
  ctx.fillStyle = '#fde2c4';
  ctx.beginPath();
  ctx.arc(0, -r * 0.55, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // hair (brown messy)
  ctx.fillStyle = '#3b2415';
  ctx.beginPath();
  ctx.arc(0, -r * 0.7, r * 0.55, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.85, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.85, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.95, r * 0.28, 0, Math.PI, true);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.5, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.18, -r * 0.5, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // eye sparkle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.52, r * 0.025, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.52, r * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // mouth - smile or scared
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (p.hitFlash > 0) {
    // ouch face
    ctx.arc(0, -r * 0.35, r * 0.12, 0, Math.PI);
  } else {
    ctx.arc(0, -r * 0.38, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
  }
  ctx.stroke();

  // arms - extending one when slapping
  ctx.fillStyle = '#fde2c4';
  const slapExtend = p.slapAnim > 0 ? Math.sin(p.slapAnim * Math.PI) * 14 : 0;
  // back arm
  ctx.beginPath();
  ctx.ellipse(-r * 0.7, 0, r * 0.18, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // front/slapping arm - extends forward (up in rotated frame)
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4 - slapExtend, r * 0.18, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // hand
  ctx.beginPath();
  ctx.arc(0, -r * 0.85 - slapExtend, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // if slapping, draw SLAP effect
  if (p.slapAnim > 0.4) {
    const alpha = 1 - p.slapAnim;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(0, -r * 1.4 - slapExtend, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,0,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -r * 1.4 - slapExtend, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // indicator ring for human player
  if (isHuman) {
    ctx.rotate(-(angle + Math.PI / 2));
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export function drawGirl(
  ctx: CanvasRenderingContext2D,
  p: Player,
  time: number,
  isHuman: boolean
) {
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  const angle = Math.atan2(p.facing.y, p.facing.x);
  const bobY = p.isMoving ? Math.sin(time * 0.012 + p.bob) * 1.5 : 0;
  ctx.translate(0, bobY);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius - 2, p.radius * 0.9, p.radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle + Math.PI / 2);

  if (p.hitFlash > 0) {
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 30;
  }

  const r = p.radius;
  // dress (pink)
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.2);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.2, 0, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.2, r * 0.9, r * 0.2);
  ctx.lineTo(r * 0.7, r * 0.7);
  ctx.lineTo(-r * 0.7, r * 0.7);
  ctx.closePath();
  ctx.fill();
  // dress highlight
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.4, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = '#fde2c4';
  ctx.beginPath();
  ctx.arc(0, -r * 0.55, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // long hair (blonde) - back layer
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4, r * 0.6, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  // bangs
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, -r * 0.75, r * 0.55, Math.PI, 0);
  ctx.fill();
  // pigtails
  ctx.beginPath();
  ctx.ellipse(-r * 0.55, -r * 0.4, r * 0.18, r * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.4, r * 0.18, r * 0.3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // hair ribbons
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 0.6, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.55, -r * 0.6, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.5, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.18, -r * 0.5, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // eyelashes
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.55);
  ctx.lineTo(-r * 0.32, -r * 0.6);
  ctx.moveTo(r * 0.28, -r * 0.55);
  ctx.lineTo(r * 0.32, -r * 0.6);
  ctx.stroke();
  // eye sparkle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.52, r * 0.025, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.52, r * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // mouth
  ctx.strokeStyle = '#be185d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (p.hitFlash > 0) {
    ctx.arc(0, -r * 0.35, r * 0.12, 0, Math.PI);
  } else {
    ctx.arc(0, -r * 0.38, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
  }
  ctx.stroke();
  // blush
  ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.42, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.42, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // arms
  ctx.fillStyle = '#fde2c4';
  const slapExtend = p.slapAnim > 0 ? Math.sin(p.slapAnim * Math.PI) * 14 : 0;
  // back arm
  ctx.beginPath();
  ctx.ellipse(-r * 0.7, 0, r * 0.18, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // front/slapping arm
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4 - slapExtend, r * 0.18, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // hand
  ctx.beginPath();
  ctx.arc(0, -r * 0.85 - slapExtend, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // slap effect
  if (p.slapAnim > 0.4) {
    const alpha = 1 - p.slapAnim;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(0, -r * 1.4 - slapExtend, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,100,180,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -r * 1.4 - slapExtend, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isHuman) {
    ctx.rotate(-(angle + Math.PI / 2));
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
