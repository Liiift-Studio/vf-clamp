# preview_view.py — animated NSView rendering a variable-font specimen.
#
# Specimen text is "HOHO Anes" — chosen because the H/O/N/e shapes expose
# weight/width/optical-size changes prominently:
#   • H — straight vertical strokes (weight visible)
#   • O — bowl shapes (weight + optical sizing visible)
#   • A — apex + diagonal strokes (weight + width visible)
#   • n — x-height shape (width + opsz visible)
#   • e — bowl + counter (opsz visible)
#   • s — curve + thinning (weight + opsz visible)
#
# This view animates the selected hull range over a ~2-second loop so the
# user sees what a customer would see if they instantiated the clamped
# font at any point in the licensed design space. It falls back to a
# system variable font when no source font is available (e.g. when the
# source is an open Glyphs document — that path needs CTFontManager
# registration of a temp binary which is a v1.2.3 follow-up).

import math
from typing import Dict, Optional, Tuple

try:
	import objc  # type: ignore
	from AppKit import (  # type: ignore
		NSView,
		NSColor,
		NSFont,
		NSFontDescriptor,
		NSFontVariationAttribute,
		NSAttributedString,
		NSForegroundColorAttributeName,
		NSFontAttributeName,
		NSParagraphStyleAttributeName,
		NSMutableParagraphStyle,
		NSTextAlignmentCenter,
		NSTimer,
	)
	from Foundation import NSMakeRect, NSMakePoint, NSMakeSize  # type: ignore
	try:
		from CoreText import (  # type: ignore
			CTFontCopyVariationAxes,
			CTFontCreateWithFontDescriptor,
			kCTFontVariationAxisIdentifierKey,
			kCTFontVariationAxisNameKey,
			kCTFontVariationAxisMinimumValueKey,
			kCTFontVariationAxisDefaultValueKey,
			kCTFontVariationAxisMaximumValueKey,
		)
		_CT_AXIS_API = True
	except Exception:  # noqa: BLE001
		_CT_AXIS_API = False
	_APPKIT_AVAILABLE = True
except Exception:  # noqa: BLE001 — AppKit missing on CI
	_APPKIT_AVAILABLE = False
	_CT_AXIS_API = False


SPECIMEN_TEXT = 'HOHO Anes'

# Animation period in seconds — one full back-and-forth cycle.
ANIM_PERIOD = 2.4

# Frame interval — 30 fps is plenty for a smooth axis sweep without
# burning CPU; the user is watching, not measuring latency.
FRAME_INTERVAL = 1.0 / 30.0


def is_available() -> bool:
	"""Return True iff AppKit is importable on this runtime."""
	return _APPKIT_AVAILABLE


def _axis_tag_to_int(tag: str) -> int:
	"""Pack a 4-byte axis tag (e.g. 'wght') into the 32-bit int that
	NSFontVariationAttribute keys expect. NSFontDescriptor uses the
	OpenType axis tag as a big-endian uint32 identifier."""
	if not tag or len(tag) > 4:
		return 0
	pad = tag.ljust(4)
	return (ord(pad[0]) << 24) | (ord(pad[1]) << 16) | (ord(pad[2]) << 8) | ord(pad[3])


def _int_to_axis_tag(identifier: int) -> str:
	"""Unpack a 32-bit identifier back into a 4-character axis tag.

	Used to match CTFontCopyVariationAxes results to OpenType tag names
	from the hull dict.
	"""
	if not identifier:
		return ''
	try:
		chars = [
			chr((identifier >> 24) & 0xFF),
			chr((identifier >> 16) & 0xFF),
			chr((identifier >> 8) & 0xFF),
			chr(identifier & 0xFF),
		]
		tag = ''.join(chars).rstrip()
		# Sanity check: real tags are printable ASCII.
		if tag and all(0x20 < ord(c) < 0x7F for c in tag):
			return tag
		return ''
	except (ValueError, TypeError):
		return ''


if _APPKIT_AVAILABLE:

	class AnimatedPreviewView(NSView):
		"""Custom NSView that draws SPECIMEN_TEXT and cycles axis variations.

		Public methods (call from Python):
		    setHull_(hull_dict)              — set the axis ranges to animate over
		    setFontDescriptor_(font_desc)    — set the underlying font (optional)
		    startAnimating()                 — begin the timer loop
		    stopAnimating()                  — stop the timer loop
		"""

		def init(self):  # type: ignore[override]
			self = objc.super(AnimatedPreviewView, self).init()
			if self is None:
				return None
			self._hull = {}  # type: Dict[str, Tuple[float, float]]
			self._font_size = 64.0
			self._t0 = 0.0
			self._timer = None
			self._base_descriptor = None
			self._anim_progress = 0.0
			# Map of OpenType axis tag (lowercase, e.g. 'wght') to the
			# integer identifier the *registered* font reports. Built from
			# CTFontCopyVariationAxes when setFontDescriptor_ is called.
			# Falls back to a computed tag-as-int when CoreText can't give
			# us the axes, which works for most fonts but not all.
			self._axis_id_by_tag = {}  # type: Dict[str, int]
			# v1.2.10 animation probe: optional HullPlotView that receives
			# the current variations each tick so it can render a live ring
			# inside the hull rectangle. Set via setProbeTarget_.
			self._probe_target = None
			# v1.2.14 accessibility: static label + role so VoiceOver users
			# know the view exists. Dynamic state (the lightest / heaviest
			# variation values currently shown) is exposed through
			# accessibilityValue() below.
			try:
				self.setAccessibilityLabel_('Specimen preview')
				self.setAccessibilityRoleDescription_(
					'Side-by-side preview of the lightest and heaviest '
					'instances in the licensed design space',
				)
				self.setAccessibilityHelp_(
					'Shows "HOHO Anes" rendered at the two extremes of the '
					'licensed design space so the user can verify the range.',
				)
			except (AttributeError, RuntimeError):
				pass
			return self

		def accessibilityValue(self):
			"""Dynamic description of the two extreme variations on display."""
			try:
				if not self._hull:
					return 'No instances selected. Specimen preview is dim.'
				low_parts = []
				high_parts = []
				for tag, (lo, hi) in self._hull.items():
					low_parts.append(f'{tag} {lo:g}')
					high_parts.append(f'{tag} {hi:g}')
				return (
					f'Lightest extreme: {", ".join(low_parts)}. '
					f'Heaviest extreme: {", ".join(high_parts)}.'
				)
			except Exception:
				return ''

		# --------- public PyObjC entry points (Python-callable) ----------

		def setHull_(self, hull):
			"""hull: dict[axis_tag, (lo, hi)] — pinned axes contribute lo==hi.

			Forces a redraw so the no-selection 10% opacity state lands
			immediately instead of waiting for the next animation frame.
			"""
			self._hull = dict(hull) if hull else {}
			self.setNeedsDisplay_(True)

		def setFontDescriptor_(self, descriptor):
			"""Override the underlying font descriptor.

			When None (the default), the view falls back to the system
			variable font for animation. When the caller registers a real
			variable font via CTFontManagerRegisterFontsForURL_, pass the
			descriptor from that font here.

			Also queries the font's actual axes via CTFontCopyVariationAxes
			so we use the font's reported axis identifiers instead of
			computing them from OpenType tags — necessary when the compiled
			font assigns non-standard identifiers to its axes.
			"""
			self._base_descriptor = descriptor
			self._axis_id_by_tag = {}
			if descriptor is not None and _CT_AXIS_API:
				try:
					font = CTFontCreateWithFontDescriptor(descriptor, self._font_size, None)
					if font is not None:
						axes = CTFontCopyVariationAxes(font)
						if axes:
							for axis in axes:
								try:
									identifier = axis.get(kCTFontVariationAxisIdentifierKey)
									if identifier is None:
										continue
									tag = _int_to_axis_tag(int(identifier))
									if tag:
										self._axis_id_by_tag[tag] = int(identifier)
								except (AttributeError, TypeError, ValueError):
									continue
				except (AttributeError, RuntimeError, TypeError):
					self._axis_id_by_tag = {}
			self.setNeedsDisplay_(True)

		def setProbeTarget_(self, view):
			"""Wire a HullPlotView that should receive live animation values.

			Called once at dialog construction time. While the timer is
			running, each ``tick_`` pushes the current ``_current_variations``
			dict into ``view.setProbeCoords_`` so the hull plot can draw a
			small ring at the active design-space coordinate. Pass ``None``
			to detach.
			"""
			self._probe_target = view

		def setFontSize_(self, size):
			try:
				self._font_size = float(size)
			except (TypeError, ValueError):
				pass
			self.setNeedsDisplay_(True)

		def startAnimating(self):
			"""Begin (or restart) the animation timer."""
			self.stopAnimating()
			try:
				self._timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
					FRAME_INTERVAL, self, 'tick:', None, True,
				)
			except (AttributeError, RuntimeError):
				self._timer = None

		def stopAnimating(self):
			"""Stop the timer if running.

			Also clears the probe target's ring so it doesn't visually hang
			at the last frame's coordinates when the specimen freezes.
			"""
			t = self._timer
			self._timer = None
			if t is not None:
				try:
					t.invalidate()
				except (AttributeError, RuntimeError):
					pass
			target = self._probe_target
			if target is not None:
				try:
					target.setProbeCoords_({})
				except (AttributeError, RuntimeError):
					pass

		# --------- ObjC selectors --------------------------------------

		def tick_(self, _timer):
			"""NSTimer callback — advance the animation phase and redraw.

			Also forwards the freshly-computed variations to the optional
			probe target so the hull plot can render the active position in
			lockstep with the specimen.
			"""
			self._anim_progress = (self._anim_progress + FRAME_INTERVAL) % ANIM_PERIOD
			self.setNeedsDisplay_(True)
			target = self._probe_target
			if target is not None:
				try:
					target.setProbeCoords_(self._current_variations())
				except (AttributeError, RuntimeError):
					pass

		def isOpaque(self):
			return False

		def drawRect_(self, dirtyRect):
			try:
				self._draw()
			except Exception:
				# Never let a draw error tear down the timer or the host
				# vanilla widget hierarchy.
				pass

		# --------- private rendering -----------------------------------

		def _draw(self):
			"""v1.2.17 single animated specimen.

			Renders one HOHO Anes specimen at the current animation phase
			and pairs it with the live probe ring on the hull plot: the
			specimen sweeps through the licensed design space and the ring
			traces the same path. This re-establishes the visual link
			between the two that the v1.2.13 two-up layout severed (a
			static specimen made the moving ring feel decorative).
			"""
			bounds = self.bounds()
			from AppKit import NSRectFill  # local import — Foundation is shared
			bg = NSColor.colorWithCalibratedWhite_alpha_(0.0, 0.18)
			bg.set()
			NSRectFill(bounds)

			# No-selection state: keep the 10 % opacity hint so the preview
			# area doesn't draw the eye when there's nothing to show.
			if not self._hull:
				self._draw_hint(bounds)
				return

			# Animated variations + font for this frame.
			variations = self._current_variations()
			font = self._build_font(variations)
			if font is None:
				return

			# Specimen — centred in the view above the caption strip.
			para = NSMutableParagraphStyle.alloc().init()
			para.setAlignment_(NSTextAlignmentCenter)
			specimen_attrs = {
				NSFontAttributeName: font,
				NSForegroundColorAttributeName: NSColor.labelColor(),
				NSParagraphStyleAttributeName: para,
			}
			specimen = NSAttributedString.alloc().initWithString_attributes_(
				SPECIMEN_TEXT, specimen_attrs,
			)
			tsize = specimen.size()
			specimen.drawAtPoint_(NSMakePoint(
				(bounds.size.width - tsize.width) / 2.0,
				(bounds.size.height - tsize.height) / 2.0,
			))

			# Caption — live variation values that mirror the probe position
			# inside the hull plot. labelColor (v1.2.14 contrast bump) so
			# the running values are easy to read at a glance.
			caption_attrs = {
				NSFontAttributeName: NSFont.systemFontOfSize_(
					NSFont.smallSystemFontSize(),
				),
				NSForegroundColorAttributeName: NSColor.labelColor(),
				NSParagraphStyleAttributeName: para,
			}
			caption_str = NSAttributedString.alloc().initWithString_attributes_(
				self._caption_text(variations), caption_attrs,
			)
			csize = caption_str.size()
			caption_str.drawAtPoint_(NSMakePoint(
				(bounds.size.width - csize.width) / 2.0, 6,
			))

		def _draw_hint(self, bounds):
			"""Render a faint specimen at 10% opacity when the hull is empty.

			Preserves the v1.2.4 no-selection signalling — a translucent
			specimen says "this is where the preview will appear" without
			drawing the eye.
			"""
			variations = {}
			font = self._build_font(variations)
			if font is None:
				return
			fg = NSColor.labelColor().colorWithAlphaComponent_(0.10)
			para = NSMutableParagraphStyle.alloc().init()
			para.setAlignment_(NSTextAlignmentCenter)
			attrs = {
				NSFontAttributeName: font,
				NSForegroundColorAttributeName: fg,
				NSParagraphStyleAttributeName: para,
			}
			specimen = NSAttributedString.alloc().initWithString_attributes_(
				SPECIMEN_TEXT, attrs,
			)
			text_size = specimen.size()
			specimen.drawAtPoint_(NSMakePoint(
				(bounds.size.width - text_size.width) / 2.0,
				(bounds.size.height - text_size.height) / 2.0,
			))
			caption_attrs = {
				NSFontAttributeName: NSFont.systemFontOfSize_(
					NSFont.smallSystemFontSize(),
				),
				NSForegroundColorAttributeName: NSColor.tertiaryLabelColor()
					.colorWithAlphaComponent_(0.55),
				NSParagraphStyleAttributeName: para,
			}
			hint = NSAttributedString.alloc().initWithString_attributes_(
				'(select instances to preview)', caption_attrs,
			)
			hsize = hint.size()
			hint.drawAtPoint_(NSMakePoint(
				(bounds.size.width - hsize.width) / 2.0, 6,
			))

		def _draw_half(self, rect, font, variations, label=''):
			"""Render one specimen + caption inside ``rect``.

			Used by the two-up layout — the specimen is centred horizontally
			inside ``rect`` and vertically biased toward the top, leaving a
			fixed 22-px caption strip at the bottom for the variation values.
			"""
			if font is None:
				return

			# Reserve the bottom strip for the caption.
			caption_h = 22
			specimen_rect = NSMakeRect(
				rect.origin.x, rect.origin.y + caption_h,
				rect.size.width, rect.size.height - caption_h,
			)

			para = NSMutableParagraphStyle.alloc().init()
			para.setAlignment_(NSTextAlignmentCenter)
			fg = NSColor.labelColor()
			attrs = {
				NSFontAttributeName: font,
				NSForegroundColorAttributeName: fg,
				NSParagraphStyleAttributeName: para,
			}
			specimen = NSAttributedString.alloc().initWithString_attributes_(
				SPECIMEN_TEXT, attrs,
			)
			tsize = specimen.size()
			specimen.drawAtPoint_(NSMakePoint(
				specimen_rect.origin.x
					+ (specimen_rect.size.width - tsize.width) / 2.0,
				specimen_rect.origin.y
					+ (specimen_rect.size.height - tsize.height) / 2.0,
			))

			# Caption — just the variation values; the "lightest" / "heaviest"
			# textual label tested as nearly invisible at 9.5 pt tertiary
			# colour, and the values self-disclose which side is which.
			values = '  ·  '.join(
				f'{tag} {int(v)}' if v == int(v) else f'{tag} {v:.1f}'
				for tag, v in variations.items()
			)
			# v1.2.14: caption colour bumped from secondaryLabelColor →
			# labelColor so the variation values are immediately readable
			# rather than requiring focused attention. Accessibility
			# Engineer flagged the secondary tier as below WCAG AA on dark.
			value_attrs = {
				NSFontAttributeName: NSFont.systemFontOfSize_(
					NSFont.smallSystemFontSize(),
				),
				NSForegroundColorAttributeName: NSColor.labelColor(),
				NSParagraphStyleAttributeName: para,
			}
			val = NSAttributedString.alloc().initWithString_attributes_(
				values, value_attrs,
			)
			valsize = val.size()
			val.drawAtPoint_(NSMakePoint(
				rect.origin.x + (rect.size.width - valsize.width) / 2.0,
				rect.origin.y + 6,
			))
			# Quiet "lightest" parameter is no longer used. Keep the signature
			# stable so existing callers don't need to change.
			_ = label

		# --------- helpers ---------------------------------------------

		def _current_variations(self):
			"""Compute axis values for the current animation phase.

			Each axis sweeps lo → hi → lo over ANIM_PERIOD. Pinned axes
			(lo == hi) emit a constant value. Axes are phase-offset by tag
			so wght and wdth don't sweep in lockstep — gives a richer feel.
			"""
			out = {}
			phase = self._anim_progress / ANIM_PERIOD  # 0 .. 1
			i = 0
			for tag, rng in self._hull.items():
				try:
					lo, hi = rng
				except (TypeError, ValueError):
					continue
				if lo == hi:
					out[tag] = float(lo)
					continue
				# Sine wave back-and-forth, with an axis-dependent phase.
				offset = (i * 0.17) % 1.0
				p = (phase + offset) % 1.0
				# 0 .. 1 .. 0 mapped to lo .. hi .. lo via cosine
				k = (1.0 - math.cos(2.0 * math.pi * p)) / 2.0  # 0..1..0
				out[tag] = float(lo) + (float(hi) - float(lo)) * k
				i += 1
			return out

		def _build_font(self, variations, size=None):
			"""Build an NSFont with the given variation settings.

			Returns None if neither a custom descriptor nor a system
			variable font can be resolved.

			``size`` overrides the view's ``_font_size`` when provided —
			used by the v1.2.14 two-up renderer to draw the lightest extreme
			at 75 % of the heavy size so the weight difference is visible at
			a glance even when the actual variation difference is subtle.

			Axis identifiers come from CTFontCopyVariationAxes on the
			registered font when available; falls back to computing the
			tag-as-int when the CoreText axis query failed.
			"""
			try:
				if size is None:
					size = self._font_size
				if self._base_descriptor is not None:
					base = self._base_descriptor
				else:
					# Fall back to the system variable font. macOS .AppleSystemUIFont
					# supports `wght` and `opsz` axes natively.
					base = NSFont.systemFontOfSize_(size).fontDescriptor()

				if variations:
					axis_dict = {}
					for tag, value in variations.items():
						# Prefer the identifier the font actually reported.
						identifier = self._axis_id_by_tag.get(tag)
						if identifier is None:
							identifier = _axis_tag_to_int(tag)
						if identifier:
							axis_dict[identifier] = value
					if axis_dict:
						base = base.fontDescriptorByAddingAttributes_({
							NSFontVariationAttribute: axis_dict,
						})

				font = NSFont.fontWithDescriptor_size_(base, size)
				return font
			except (AttributeError, RuntimeError, ValueError):
				return None

		def _caption_text(self, variations):
			if not variations:
				return '(select instances to preview)'
			parts = []
			for tag, val in variations.items():
				if val == int(val):
					parts.append(f'{tag} {int(val)}')
				else:
					parts.append(f'{tag} {val:.1f}')
			return '  ·  '.join(parts)


def make_preview_view(frame: Tuple[float, float, float, float]):
	"""Return a configured AnimatedPreviewView, or None on a non-AppKit runtime.

	Caller is responsible for mounting the view into the window content view
	at the given frame and calling startAnimating() / stopAnimating()
	at lifecycle points.
	"""
	if not _APPKIT_AVAILABLE:
		return None
	try:
		view = AnimatedPreviewView.alloc().init()
		view.setFrame_(NSMakeRect(*frame))
		return view
	except (AttributeError, RuntimeError):
		return None
