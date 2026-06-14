# hull_plot.py — custom NSView that draws a 1- or 2-axis hull preview.
# Falls back gracefully when AppKit primitives are unavailable (e.g. during
# headless unit tests on a Linux CI box) so importing this module never
# raises on a non-mac platform.

from typing import Dict, List, Optional, Tuple

try:
	import objc  # type: ignore
	from AppKit import (  # type: ignore
		NSView,
		NSColor,
		NSBezierPath,
		NSRectFill,
		NSFont,
		NSAttributedString,
		NSForegroundColorAttributeName,
		NSFontAttributeName,
		NSTimer,
		NSAccessibilityElement,
	)
	from Foundation import NSMakeRect, NSMakePoint  # type: ignore
	_APPKIT_AVAILABLE = True
except Exception:  # noqa: BLE001 — AppKit may be entirely missing under CI
	_APPKIT_AVAILABLE = False


# Inner padding used by the plot so axis labels and tick marks don't crowd
# the canvas edge. Generous enough to leave room for a "0–100" tick label
# on either side of a 1-axis bar.
PLOT_PAD = 16

# Extra inset INSIDE the plot rectangle so per-instance dots drawn at the
# extremes of the axis range stay fully inside the chart border instead of
# clipping against it. Sized to match the largest selected-dot radius (5)
# plus a couple pixels of breathing room.
DOT_INSET = 8


def is_available() -> bool:
	"""Return True iff AppKit is importable on this runtime."""
	return _APPKIT_AVAILABLE


if _APPKIT_AVAILABLE:

	class _HullDotAccessibilityElement(NSAccessibilityElement):
		"""NSAccessibilityElement proxy for a single instance dot.

		HullPlotView paints all 36 (or however many) instance dots into a
		single NSView, so VoiceOver has no per-dot subview to navigate. We
		fix that by handing VoiceOver a list of these proxy elements — one
		per instance — each with role=AXButton, a dynamic label that
		describes the instance's name + axis values + selection state, an
		accessibilityFrame computed from the last drawn dot position, and
		an accessibilityPerformPress that fires the same callback as a
		mouse click. Result: VoiceOver users can navigate dot-by-dot and
		toggle selections, the same way sighted users do.
		"""

		def initWithDotIndex_view_(self, idx, view):
			self = objc.super(_HullDotAccessibilityElement, self).init()
			if self is None:
				return None
			self._idx = int(idx)
			self._view_ref = view
			return self

		def accessibilityRole(self):
			return 'AXButton'

		def accessibilityRoleDescription(self):
			return 'instance dot'

		def accessibilityLabel(self):
			view = self._view_ref
			if view is None:
				return ''
			try:
				coords = view._instances[self._idx]
				checked = self._idx in view._selected
				parts = [f'{tag} {v:g}' for tag, v in coords.items()]
				state = 'selected' if checked else 'unselected'
				return f'Instance {self._idx + 1}: {", ".join(parts)}, {state}'
			except (IndexError, AttributeError, KeyError):
				return ''

		def isAccessibilityElement(self):
			return True

		def accessibilityParent(self):
			return self._view_ref

		def accessibilityFrame(self):
			"""Screen-space rect of this dot — looked up from the last draw."""
			view = self._view_ref
			if view is None:
				return NSMakeRect(0.0, 0.0, 0.0, 0.0)
			zones = getattr(view, '_instance_hit_zones', None)
			if not zones:
				return NSMakeRect(0.0, 0.0, 0.0, 0.0)
			try:
				for idx, cx, cy in zones:
					if idx == self._idx:
						local = NSMakeRect(cx - 7, cy - 7, 14, 14)
						# View-relative → window → screen.
						in_win = view.convertRect_toView_(local, None)
						win = view.window()
						if win is None:
							return in_win
						return win.convertRectToScreen_(in_win)
			except (AttributeError, RuntimeError):
				pass
			return NSMakeRect(0.0, 0.0, 0.0, 0.0)

		def accessibilityPerformPress(self):
			"""Toggle this instance — same path as a mouse click on the dot."""
			view = self._view_ref
			if view is None:
				return False
			cb = getattr(view, '_on_instance_click', None)
			if cb is None:
				return False
			try:
				cb(self._idx)
				return True
			except Exception:
				return False


	class HullPlotView(NSView):
		"""Custom NSView rendering 1- or 2-axis hull previews.

		For 1 axis: a horizontal bar showing the full axis range with the
		selected sub-hull tinted in the control accent colour.

		For 2 axes: a rectangle in axis-coord space, the full design space
		as a thin border and the selected hull as a filled accent rect.

		For >=3 axes the view simply paints a centred "(see chips)" hint
		because a 2D plot would mislead. Callers are expected to hide the
		view in that case and surface the chips fallback instead.

		Drawing is deliberately defensive: any failure inside drawRect_ is
		swallowed so a malformed hull cannot crash the dialog.
		"""

		def initWithFrame_(self, frame):
			"""Initialise with an empty model. ``set_hull_`` populates it later."""
			self = objc.super(HullPlotView, self).initWithFrame_(frame)
			if self is None:
				return None
			self._hull = {}            # type: Dict[str, Tuple[float, float]]
			self._axis_ranges = {}     # type: Dict[str, Tuple[float, float, float]]
			self._axis_colors = {}     # type: Dict[str, Tuple[float, float, float]]
			# v1.2.9 interactive plot: per-instance coords + selection mask +
			# Python callback the view invokes when a dot is clicked.
			self._instances = []       # type: List[Dict[str, float]]
			self._selected = set()     # type: set[int]
			self._on_instance_click = None  # callable(index) → None
			# v1.2.10 animation probe: live axis values pushed in by the
			# AnimatedPreviewView each frame so the plot can show where the
			# specimen currently is inside the licensed design space.
			self._probe_coords = {}    # type: Dict[str, float]
			# v1.2.13 live-toggle highlight: when an instance dot is toggled
			# (via the checkbox list or a click on the dot itself), draw an
			# expanding/fading ring around it for ~400 ms so the eye catches
			# the state change. Driven by an NSTimer that ticks the age
			# forward at 30 fps and invalidates itself when done.
			self._toggle_highlight_idx = None    # type: Optional[int]
			self._toggle_highlight_age = 0.0     # seconds since toggle
			self._toggle_highlight_timer = None
			# v1.2.14 accessibility: static label + role so VoiceOver users
			# can at least know the view exists and what it represents. The
			# dynamic state (current hull, selection count, axis ranges) is
			# exposed through accessibilityValue() below.
			try:
				self.setAccessibilityLabel_('Design space chart')
				self.setAccessibilityRoleDescription_(
					'2D chart showing the licensed variable font design space',
				)
				self.setAccessibilityHelp_(
					'Visual map of which named instances are licensed. '
					'Click a dot to toggle that instance. Use the instance '
					'list to the left for keyboard selection.',
				)
			except (AttributeError, RuntimeError):
				pass
			return self

		def accessibilityValue(self):
			"""Dynamic description of the chart's current state.

			Returned to VoiceOver when the view is focused. We summarise:
			how many instances are selected, the per-axis hull range, and
			whether each axis is pinned. The user gets a single sentence
			that conveys what they would otherwise have to visually scan.
			"""
			try:
				n_sel = len(self._selected)
				n_total = len(self._instances)
				if not self._hull:
					return f'No instances selected. {n_total} instances available.'
				parts = []
				for tag, (lo, hi) in self._hull.items():
					if lo == hi:
						parts.append(f'{tag} pinned at {lo:g}')
					else:
						parts.append(f'{tag} from {lo:g} to {hi:g}')
				return (
					f'{n_sel} of {n_total} instances selected. '
					f'Licensed design space: {", ".join(parts)}.'
				)
			except Exception:
				return ''

		def isAccessibilityElement(self):
			"""Force VoiceOver to treat the chart as a navigable group."""
			return True

		def accessibilityChildren(self):
			"""Expose one navigable child per instance dot.

			Cached lazily and rebuilt whenever the instance list changes.
			VoiceOver users navigate dot-by-dot with VO + arrow keys and
			toggle each one with VO + Space, matching the mouse-click
			behaviour exactly.
			"""
			if not getattr(self, '_a11y_children_dirty', True):
				cached = getattr(self, '_a11y_children_cache', None)
				if cached is not None:
					return cached
			n = len(self._instances)
			children = []
			for i in range(n):
				elem = _HullDotAccessibilityElement.alloc().initWithDotIndex_view_(
					i, self,
				)
				if elem is not None:
					children.append(elem)
			self._a11y_children_cache = children
			self._a11y_children_dirty = False
			return children

		def setHull_axisRanges_axisColors_(self, hull, axis_ranges, axis_colors):
			"""Update the model and request a redraw.

			``hull`` — ``{tag: (lo, hi)}`` of the selected sub-hull.
			``axis_ranges`` — ``{tag: (min, default, max)}`` of the full font.
			``axis_colors`` — ``{tag: (r, g, b)}`` sRGB floats per axis tag.
			"""
			self._hull = dict(hull or {})
			self._axis_ranges = dict(axis_ranges or {})
			self._axis_colors = dict(axis_colors or {})
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass

		# Highlight animation: ~400 ms expanding ring around the most-recently
		# toggled instance dot. Ticked by an NSTimer at 30 fps.
		HIGHLIGHT_DURATION = 0.40
		HIGHLIGHT_INTERVAL = 1.0 / 30.0
		HIGHLIGHT_MAX_RADIUS = 14.0

		def setRecentlyToggled_(self, idx):
			"""Trigger the live-toggle highlight on the dot at ``idx``.

			Called from the dialog whenever a user flips a checkbox or
			clicks a dot in the interactive plot. Resets the animation age
			and (re)starts the NSTimer that drives the redraws.
			"""
			try:
				self._toggle_highlight_idx = int(idx)
			except (TypeError, ValueError):
				return
			self._toggle_highlight_age = 0.0
			# Cancel any in-flight highlight before starting a new one so
			# rapid-fire toggles always animate from the latest dot.
			t = self._toggle_highlight_timer
			if t is not None:
				try:
					t.invalidate()
				except (AttributeError, RuntimeError):
					pass
				self._toggle_highlight_timer = None
			try:
				self._toggle_highlight_timer = (
					NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
						self.HIGHLIGHT_INTERVAL,
						self, 'tickHighlight:', None, True,
					)
				)
			except (AttributeError, RuntimeError):
				self._toggle_highlight_timer = None
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass

		def tickHighlight_(self, _timer):
			"""NSTimer callback — advance the highlight age + invalidate."""
			self._toggle_highlight_age += self.HIGHLIGHT_INTERVAL
			if self._toggle_highlight_age >= self.HIGHLIGHT_DURATION:
				self._toggle_highlight_idx = None
				t = self._toggle_highlight_timer
				self._toggle_highlight_timer = None
				if t is not None:
					try:
						t.invalidate()
					except (AttributeError, RuntimeError):
						pass
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass

		def setProbeCoords_(self, coords):
			"""Set the live animation probe position.

			``coords`` — mapping ``{tag: value}`` of the variations the
			specimen view is currently rendering. Called ~30×/sec by the
			AnimatedPreviewView's tick. Only the axes that match the
			current 2D plot's tags actually render — everything else is
			retained but ignored. Passing ``None`` or ``{}`` clears the probe
			(useful when the preview stops animating).
			"""
			self._probe_coords = dict(coords) if coords else {}
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass

		def setInstances_selectedIndices_onClick_(self, instances, selected_indices, on_click):
			"""Make the plot interactive.

			``instances`` — list of per-instance coord dicts, parallel to the
			dialog's instance list. Each dict maps axis tag → float value.
			``selected_indices`` — iterable of ints; rows currently ticked.
			``on_click`` — Python callable invoked with the clicked instance's
			index whenever the user clicks the dot. Pass ``None`` to disable
			click handling (e.g. before any font is loaded).
			"""
			prev_len = len(getattr(self, '_instances', []))
			self._instances = list(instances or [])
			try:
				self._selected = set(int(i) for i in (selected_indices or []))
			except (TypeError, ValueError):
				self._selected = set()
			self._on_instance_click = on_click
			# v1.2.15: invalidate the a11y children cache whenever the
			# instance roster changes so VoiceOver picks up new/removed
			# dots without restarting. (Selection-only changes don't need
			# a new cache because each child's label is computed lazily.)
			if len(self._instances) != prev_len:
				self._a11y_children_dirty = True
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass

		def isFlipped(self):
			"""Use top-left origin so layout maths matches everything else."""
			return True

		def acceptsFirstMouse_(self, event):
			"""Accept clicks even when the dialog is in the background."""
			return True

		def acceptsFirstResponder(self):
			"""Allow keyboard focus so Tab can cycle to the chart.

			v1.2.15 a11y addition: the Accessibility Engineer flagged that
			the chart was unreachable by keyboard. Becoming first responder
			lets Tab focus land here and lets us paint the focus ring below.
			"""
			return True

		def becomeFirstResponder(self):
			"""Trigger a redraw so the focus ring paints."""
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass
			return objc.super(HullPlotView, self).becomeFirstResponder()

		def resignFirstResponder(self):
			"""Trigger a redraw so the focus ring clears."""
			try:
				self.setNeedsDisplay_(True)
			except Exception:
				pass
			return objc.super(HullPlotView, self).resignFirstResponder()

		def mouseDown_(self, event):
			"""Toggle the instance nearest to the click point.

			Hit tests against the most recent ``_instance_hit_zones`` set
			built by ``_draw_two_axes`` — so we always reflect what was
			last drawn. Hit radius is 8 px (comfortable for trackpad use).
			"""
			cb = self._on_instance_click
			zones = getattr(self, '_instance_hit_zones', None)
			if cb is None or not zones:
				return
			try:
				loc = self.convertPoint_fromView_(
					event.locationInWindow(), None,
				)
			except (AttributeError, RuntimeError):
				return
			HIT_RADIUS_SQ = 8.0 * 8.0
			best_idx = None
			best_dist_sq = HIT_RADIUS_SQ
			lx, ly = loc.x, loc.y
			for idx, cx, cy in zones:
				dx = cx - lx
				dy = cy - ly
				dsq = dx * dx + dy * dy
				if dsq <= best_dist_sq:
					best_idx = idx
					best_dist_sq = dsq
			if best_idx is not None:
				try:
					cb(best_idx)
				except Exception:
					# A throwing callback must never tear down the AppKit
					# event loop. Swallow and move on.
					pass

		def drawRect_(self, rect):
			"""Paint the hull. All failures are swallowed (see class docstring)."""
			try:
				self._draw()
			except Exception:
				# Last-resort: leave the canvas blank rather than crash Glyphs.
				pass
			# v1.2.15 keyboard focus ring — painted last so it sits above the
			# chart contents. Only renders when this view is first responder.
			try:
				window = self.window()
				is_focus = (
					window is not None
					and window.firstResponder() is self
				)
				if is_focus:
					bounds = self.bounds()
					ring = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
						NSMakeRect(
							bounds.origin.x + 1, bounds.origin.y + 1,
							bounds.size.width - 2, bounds.size.height - 2,
						),
						4.0, 4.0,
					)
					NSColor.controlAccentColor().set()
					ring.setLineWidth_(2.0)
					ring.stroke()
			except Exception:
				pass

		def _draw(self):
			"""Inner draw implementation. Split out so drawRect_ stays trivial."""
			bounds = self.bounds()
			# Background — translucent so the surrounding vanilla.Box theme shows
			# through. We deliberately do NOT fill solid; that would clash with
			# Glyphs' dark translucent panels.
			bg = NSColor.windowBackgroundColor().colorWithAlphaComponent_(0.0)
			bg.set()
			NSRectFill(bounds)

			tags = list(self._hull.keys())
			if not tags:
				self._draw_hint('(select instances to preview)')
				return
			if len(tags) >= 3:
				self._draw_hint('(see axis chips)')
				return

			if len(tags) == 1:
				self._draw_one_axis(tags[0], bounds)
			else:
				self._draw_two_axes(tags[0], tags[1], bounds)

		def _draw_hint(self, text):
			"""Render a centred dim placeholder string."""
			try:
				attrs = {
					NSForegroundColorAttributeName: NSColor.tertiaryLabelColor(),
					NSFontAttributeName: NSFont.systemFontOfSize_(
						NSFont.smallSystemFontSize()
					),
				}
				s = NSAttributedString.alloc().initWithString_attributes_(text, attrs)
				size = s.size()
				bounds = self.bounds()
				x = (bounds.size.width - size.width) / 2
				y = (bounds.size.height - size.height) / 2
				s.drawAtPoint_(NSMakePoint(x, y))
			except Exception:
				pass

		def _axis_color(self, tag):
			"""Return an NSColor for ``tag``, defaulting to accent."""
			rgb = self._axis_colors.get(tag)
			if rgb is None:
				return NSColor.controlAccentColor()
			return NSColor.colorWithSRGBRed_green_blue_alpha_(
				rgb[0], rgb[1], rgb[2], 1.0
			)

		def _draw_one_axis(self, tag, bounds):
			"""Horizontal bar: full range as a thin track, hull as a thick fill."""
			rng = self._axis_ranges.get(tag)
			lo, hi = self._hull[tag]
			# Fall back to the hull bounds if we don't know the full range —
			# better than refusing to draw.
			if rng is None:
				axis_min, axis_max = lo, hi
			else:
				axis_min, _, axis_max = rng
			if axis_max <= axis_min:
				self._draw_hint(f'{tag} pinned at {lo:g}')
				return

			pad = PLOT_PAD
			track_y = bounds.size.height / 2 - 4
			track_h = 8
			track_x = pad
			track_w = bounds.size.width - 2 * pad

			# Track (muted)
			NSColor.tertiaryLabelColor().set()
			path = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
				NSMakeRect(track_x, track_y, track_w, track_h), 4.0, 4.0,
			)
			path.fill()

			# Filled hull region
			t0 = (lo - axis_min) / (axis_max - axis_min)
			t1 = (hi - axis_min) / (axis_max - axis_min)
			fill_x = track_x + t0 * track_w
			fill_w = max(2.0, (t1 - t0) * track_w)
			self._axis_color(tag).set()
			fill_path = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
				NSMakeRect(fill_x, track_y, fill_w, track_h), 4.0, 4.0,
			)
			fill_path.fill()

			# Labels: tag on the left, range underneath
			label = f'{tag}  {lo:g} – {hi:g}' if lo != hi else f'{tag}  pinned at {lo:g}'
			self._draw_label(label, NSMakePoint(pad, track_y - 18))

			# Axis-min/max ticks under the bar
			tick_attrs = {
				NSForegroundColorAttributeName: NSColor.tertiaryLabelColor(),
				NSFontAttributeName: NSFont.systemFontOfSize_(9.0),
			}
			lo_str = NSAttributedString.alloc().initWithString_attributes_(
				f'{axis_min:g}', tick_attrs,
			)
			hi_str = NSAttributedString.alloc().initWithString_attributes_(
				f'{axis_max:g}', tick_attrs,
			)
			lo_str.drawAtPoint_(NSMakePoint(track_x, track_y + track_h + 2))
			hi_size = hi_str.size()
			hi_str.drawAtPoint_(NSMakePoint(
				track_x + track_w - hi_size.width, track_y + track_h + 2,
			))

		def _draw_two_axes(self, tag_x, tag_y, bounds):
			"""2D rect: full space border, hull as filled accent rectangle."""
			rng_x = self._axis_ranges.get(tag_x)
			rng_y = self._axis_ranges.get(tag_y)
			lo_x, hi_x = self._hull[tag_x]
			lo_y, hi_y = self._hull[tag_y]

			ax_x_min, _, ax_x_max = rng_x if rng_x else (lo_x, lo_x, hi_x)
			ax_y_min, _, ax_y_max = rng_y if rng_y else (lo_y, lo_y, hi_y)

			if ax_x_max <= ax_x_min or ax_y_max <= ax_y_min:
				self._draw_hint(f'{tag_x} × {tag_y}')
				return

			pad = PLOT_PAD
			# Leave room at the bottom for axis labels.
			plot_x = pad
			plot_y = pad
			plot_w = bounds.size.width - 2 * pad
			plot_h = bounds.size.height - 2 * pad - 14

			# Full design space — thin border.
			NSColor.tertiaryLabelColor().set()
			border = NSBezierPath.bezierPathWithRect_(
				NSMakeRect(plot_x, plot_y, plot_w, plot_h),
			)
			border.setLineWidth_(1.0)
			border.stroke()

			# v1.2.13: axis tick marks at min / mid / max on each axis with
			# numeric labels at the chart corners. Addresses the Information
			# Designer's critical finding that the chart had no numeric scale
			# ON the chart itself — only a "wght: lo–hi" text line below.
			#
			# v1.2.14: bumped from secondaryLabelColor 1.0 pt → labelColor
			# 1.5 pt after the second designer review said the ticks were
			# still too faint for reliable discoverability on dark panels.
			TICK_LEN = 5.0
			TICK_FRACTIONS = (0.0, 0.5, 1.0)
			NSColor.labelColor().set()
			ticks = NSBezierPath.bezierPath()
			for t in TICK_FRACTIONS:
				# Bottom (x-axis) tick — extends down below the border.
				tx = plot_x + DOT_INSET + t * (plot_w - 2 * DOT_INSET)
				ticks.moveToPoint_(NSMakePoint(tx, plot_y + plot_h))
				ticks.lineToPoint_(NSMakePoint(tx, plot_y + plot_h + TICK_LEN))
				# Left (y-axis) tick — extends left beyond the border.
				ty = plot_y + DOT_INSET + t * (plot_h - 2 * DOT_INSET)
				ticks.moveToPoint_(NSMakePoint(plot_x, ty))
				ticks.lineToPoint_(NSMakePoint(plot_x - TICK_LEN, ty))
			ticks.setLineWidth_(1.5)
			ticks.stroke()

			# Corner numeric labels — anchored INSIDE the chart at all four
			# corners. Putting them inside keeps everything within the view
			# bounds (the chart sits at PLOT_PAD=16, so there isn't enough
			# left/right margin for external labels) and makes the chart
			# read like a coordinate plane.
			#
			# v1.2.14: bumped from secondaryLabelColor → labelColor after
			# the Accessibility Engineer flagged the secondary tier as
			# insufficient contrast against the dark Glyphs panel for
			# WCAG AA compliance.
			corner_attrs = {
				NSForegroundColorAttributeName: NSColor.labelColor(),
				NSFontAttributeName: NSFont.systemFontOfSize_(9.5),
			}
			def _corner(text, pt):
				NSAttributedString.alloc().initWithString_attributes_(
					text, corner_attrs,
				).drawAtPoint_(pt)
			INSET = 4
			# Bottom-left: x_min, y_min (chart origin).
			_corner(
				f'{ax_x_min:g},{ax_y_min:g}',
				NSMakePoint(plot_x + INSET, plot_y + plot_h - 13),
			)
			# Bottom-right: x_max.
			_corner(
				f'{ax_x_max:g}',
				NSMakePoint(plot_x + plot_w - 28, plot_y + plot_h - 13),
			)
			# Top-left: y_max (top in flipped coords).
			_corner(
				f'{ax_y_max:g}',
				NSMakePoint(plot_x + INSET, plot_y + INSET),
			)

			# Hull rect. Map values into an inset rectangle so dots at the
			# axis extremes (e.g. wght=min, opsz=max) stay fully inside the
			# plot border instead of clipping against it.
			inner_x = plot_x + DOT_INSET
			inner_y = plot_y + DOT_INSET
			inner_w = max(1.0, plot_w - 2 * DOT_INSET)
			inner_h = max(1.0, plot_h - 2 * DOT_INSET)
			def normx(v):
				return inner_x + (v - ax_x_min) / (ax_x_max - ax_x_min) * inner_w
			def normy(v):
				# Top-left origin (isFlipped): higher y_tag value = lower y pixel.
				t = (v - ax_y_min) / (ax_y_max - ax_y_min)
				return inner_y + inner_h - t * inner_h

			x0 = normx(lo_x)
			x1 = normx(hi_x)
			y0 = normy(hi_y)  # top edge corresponds to higher tag value
			y1 = normy(lo_y)
			fill_w = max(2.0, x1 - x0)
			fill_h = max(2.0, y1 - y0)
			# Soften the hull fill so dots inside the rectangle stay legible
			# instead of washing into the accent colour. 0.55 alpha was
			# enough to read the rect's bounds but bullied the dots; 0.30
			# leaves the same shape signal while letting the dots breathe.
			self._axis_color(tag_x).colorWithAlphaComponent_(0.30).set()
			fill_path = NSBezierPath.bezierPathWithRect_(
				NSMakeRect(x0, y0, fill_w, fill_h),
			)
			fill_path.fill()

			# Crosshair stroke at hull edges, tinted by Y axis
			self._axis_color(tag_y).set()
			outline = NSBezierPath.bezierPathWithRect_(
				NSMakeRect(x0, y0, fill_w, fill_h),
			)
			outline.setLineWidth_(1.0)
			outline.stroke()

			# v1.2.9 interactive plot: draw a dot per instance + remember
			# their pixel positions so mouseDown_ can hit-test.
			self._instance_hit_zones = []  # list of (idx, cx, cy)
			for idx, coords in enumerate(self._instances):
				try:
					if tag_x not in coords or tag_y not in coords:
						continue
					vx = float(coords[tag_x])
					vy = float(coords[tag_y])
				except (TypeError, ValueError):
					continue
				cx = normx(vx)
				cy = normy(vy)
				is_sel = idx in self._selected
				# v1.2.12 widened the gap between selected and unselected
				# (5.0 vs 2.5) after a multi-designer review said the prior
				# 4-vs-3 split read as the same-size dot in different colours.
				# v1.2.14 nudged unselected back up to 3.5 after the
				# Accessibility Engineer flagged 2.5 px as below the visual
				# minimum on dark panels (WCAG visual-affordance concern).
				# 5 vs 3.5 still reads as a decisive hierarchy.
				radius = 5.0 if is_sel else 3.5
				dot = NSBezierPath.bezierPathWithOvalInRect_(NSMakeRect(
					cx - radius, cy - radius, radius * 2, radius * 2,
				))
				if is_sel:
					# Filled accent dot for selected instances.
					self._axis_color(tag_x).set()
					dot.fill()
					NSColor.labelColor().set()
					dot.setLineWidth_(1.0)
					dot.stroke()
				else:
					# Outline-only for unselected instances. secondaryLabelColor
					# is brighter than tertiaryLabelColor, which made the
					# unselected dots vanish into the dark Glyphs panel. The
					# new contrast level is still clearly subordinate to the
					# filled selected dots.
					NSColor.secondaryLabelColor().set()
					dot.setLineWidth_(1.5)
					dot.stroke()
				self._instance_hit_zones.append((idx, cx, cy))

			# v1.2.13 live-toggle highlight — expanding fading ring around
			# the just-toggled dot. White stroke for high contrast on top
			# of the translucent hull fill OR empty design space; renders
			# before the probe ring so the probe still wins z-order when
			# they overlap.
			hi_idx = self._toggle_highlight_idx
			if hi_idx is not None and 0 <= hi_idx < len(self._instances):
				try:
					hcoords = self._instances[hi_idx]
					if tag_x in hcoords and tag_y in hcoords:
						hx = normx(float(hcoords[tag_x]))
						hy = normy(float(hcoords[tag_y]))
						# Eased age 0..1 — radius grows + alpha fades.
						t = min(
							1.0,
							self._toggle_highlight_age / self.HIGHLIGHT_DURATION,
						)
						# Smoothstep-ish ease so the ring expands quickly
						# at first then slows.
						eased = 1.0 - (1.0 - t) * (1.0 - t)
						hradius = 6.0 + eased * (self.HIGHLIGHT_MAX_RADIUS - 6.0)
						halpha = max(0.0, 1.0 - t)
						hring = NSBezierPath.bezierPathWithOvalInRect_(NSMakeRect(
							hx - hradius, hy - hradius,
							hradius * 2, hradius * 2,
						))
						NSColor.whiteColor().colorWithAlphaComponent_(halpha).set()
						hring.setLineWidth_(2.5)
						hring.stroke()
				except (TypeError, ValueError):
					pass

			# Animation probe ring — render last so it sits above the dots.
			# Drawn as a hollow circle at the current animation position so
			# the user can see, in real time, which point inside the licensed
			# design space the HOHO Anes specimen is rendering at.
			probe_x = self._probe_coords.get(tag_x)
			probe_y = self._probe_coords.get(tag_y)
			if probe_x is not None and probe_y is not None:
				try:
					px = normx(float(probe_x))
					py = normy(float(probe_y))
					# v1.2.17: simplified to a single solid white fill at
					# 25 % alpha. The previous two-pass halo + bright stroke
					# read as a heavy badge sitting on top of the chart; a
					# soft translucent fill reads as a gentle tracker that
					# pairs naturally with the live animated specimen below.
					probe_r = 6.5
					probe = NSBezierPath.bezierPathWithOvalInRect_(NSMakeRect(
						px - probe_r, py - probe_r, probe_r * 2, probe_r * 2,
					))
					NSColor.whiteColor().colorWithAlphaComponent_(0.25).set()
					probe.fill()
				except (TypeError, ValueError):
					pass

			# Axis labels under the plot. Hull range first (what's licensed),
			# full font range second in muted text so the user can see the
			# selection in the context of the design space. Axes whose
			# selection collapses to a single value get a "pinned" tag
			# instead of an awkward "253–253" range.
			#
			# v1.2.15 defensive layout: for fonts with multiple long axis
			# tags (GRAD, XTRA, MONO) the combined " on one line"
			# rendering ran off the chart. Measure first, then split onto
			# two stacked lines per axis if a single line would overflow.
			def _fmt(tag, lo, hi):
				if lo == hi:
					return f'{tag}: pinned {lo:g}'
				return f'{tag}: {lo:g}–{hi:g}'
			part_x = _fmt(tag_x, lo_x, hi_x)
			part_y = _fmt(tag_y, lo_y, hi_y)
			single = f'{part_x}   {part_y}'
			available_w = bounds.size.width - 2 * pad
			measure_attrs = {
				NSFontAttributeName: NSFont.systemFontOfSize_(
					NSFont.smallSystemFontSize(),
				),
			}
			single_w = NSAttributedString.alloc().initWithString_attributes_(
				single, measure_attrs,
			).size().width
			if single_w <= available_w:
				self._draw_label(single, NSMakePoint(pad, plot_y + plot_h + 2))
				full_y = plot_y + plot_h + 16
			else:
				# Stack each axis on its own line.
				self._draw_label(part_x, NSMakePoint(pad, plot_y + plot_h + 2))
				self._draw_label(part_y, NSMakePoint(pad, plot_y + plot_h + 14))
				full_y = plot_y + plot_h + 28
			# Full-range subtext also gets the same wrap treatment.
			full_x = f'full: {tag_x} {ax_x_min:g}–{ax_x_max:g}'
			full_y_part = f'{tag_y} {ax_y_min:g}–{ax_y_max:g}'
			full_single = f'{full_x}   {full_y_part}'
			full_measure = NSAttributedString.alloc().initWithString_attributes_(
				full_single,
				{NSFontAttributeName: NSFont.systemFontOfSize_(9.0)},
			).size().width
			try:
				attrs = {
					NSForegroundColorAttributeName: NSColor.tertiaryLabelColor(),
					NSFontAttributeName: NSFont.systemFontOfSize_(9.0),
				}
				if full_measure <= available_w:
					s = NSAttributedString.alloc().initWithString_attributes_(
						full_single, attrs,
					)
					s.drawAtPoint_(NSMakePoint(pad, full_y))
				else:
					s1 = NSAttributedString.alloc().initWithString_attributes_(
						full_x, attrs,
					)
					s2 = NSAttributedString.alloc().initWithString_attributes_(
						f'      {full_y_part}', attrs,
					)
					s1.drawAtPoint_(NSMakePoint(pad, full_y))
					s2.drawAtPoint_(NSMakePoint(pad, full_y + 12))
			except Exception:
				pass

		def _draw_label(self, text, point):
			"""Render a small primary-color label at ``point``."""
			try:
				attrs = {
					NSForegroundColorAttributeName: NSColor.labelColor(),
					NSFontAttributeName: NSFont.systemFontOfSize_(
						NSFont.smallSystemFontSize()
					),
				}
				s = NSAttributedString.alloc().initWithString_attributes_(text, attrs)
				s.drawAtPoint_(point)
			except Exception:
				pass


def make_hull_plot_view(frame: Tuple[float, float, float, float]):
	"""Return a new HullPlotView at ``frame`` or None if AppKit is missing.

	``frame`` is ``(x, y, w, h)`` in the parent view's coord system.
	"""
	if not _APPKIT_AVAILABLE:
		return None
	view = HullPlotView.alloc().initWithFrame_(
		NSMakeRect(frame[0], frame[1], frame[2], frame[3]),
	)
	return view
