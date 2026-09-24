# Tasks: BSB Instrument Loading & Orchestra Generation

**Input**: Design documents from `specs/004-bsb-instruments/`
**Prerequisites**: Specs 001-003 complete (data model, engine, audio pipeline)

The developer-local `demo2022.blue` integration suite used for some completed tasks
below was removed from automated tests on 2026-09-24. These checkboxes record the
original implementation work, not current test coverage.

---

## Phase 18: BSB Data Model

### BSBCompilationUnit
- [x] T401 [P] Create `instruments/blue-synth-builder/bsb-compilation-unit.ts` — replacement value map + text replacer
- [x] T402 [P] Implement `addReplacementValue(key, value)` and `replaceBSBValues(instrumentText)`

### BSBWidget Base
- [x] T403 Create `instruments/blue-synth-builder/bsb-widget.ts` — base interface with objectName, value, min, max, parameterName
- [x] T404 [P] Implement `collectReplacements(unit)` for base widget

### BSBGroup
- [x] T405 Create `instruments/blue-synth-builder/bsb-group.ts` — container for nested bsbObject children
- [x] T406 [P] Implement recursive `collectReplacements()` that walks all child widgets

### BSBKnob
- [x] T407 Create `instruments/blue-synth-builder/bsb-knob.ts` — knobWidth property
- [x] T408 [P] Implement XML load with objectName, x, y, value, min, max, knobWidth

### BSBCheckBox
- [x] T409 Create `instruments/blue-synth-builder/bsb-check-box.ts` — checkedVal, uncheckedVal properties
- [x] T410 [P] Implement XML load with objectName, value, checkedVal, uncheckedVal

### BSBHSlider / BSBVSlider
- [x] T411 Create `instruments/blue-synth-builder/bsb-hslider.ts` — sliderWidth property
- [x] T412 [P] Create `instruments/blue-synth-builder/bsb-vslider.ts` — sliderHeight property
- [x] T413 [P] Implement XML load for both types

### BSBHSliderBank / BSBVSliderBank
- [x] T414 Create `instruments/blue-synth-builder/bsb-hslider-bank.ts` — bank of sliders
- [x] T415 [P] Create `instruments/blue-synth-builder/bsb-vslider-bank.ts` — bank of sliders
- [x] T416 Implement XML load for bank types (multiple values per widget)

### BSBValue / BSBDropdown / BSBXYController
- [x] T417 Create `instruments/blue-synth-builder/bsb-value.ts` — numeric display
- [x] T418 Create `instruments/blue-synth-builder/bsb-dropdown.ts` — dropdown with BSBDropdownItemList
- [x] T419 Create `instruments/blue-synth-builder/bsb-dropdown-item.ts` — dropdown item
- [x] T420 Create `instruments/blue-synth-builder/bsb-xy-controller.ts` — 2D XY pad
- [x] T421 [P] Implement XML load for all three types

### BSBSubChannelDropdown / BSBFileSelector / BSBTextField
- [x] T422 Create `instruments/blue-synth-builder/bsb-subchannel-dropdown.ts`
- [x] T423 Create `instruments/blue-synth-builder/bsb-file-selector.ts` — string channel provider
- [x] T424 [P] Create `instruments/blue-synth-builder/bsb-text-field.ts`
- [x] T425 Implement XML load for all three types

### BSBLabel / BSBLineObject (no values)
- [x] T426 Create `instruments/blue-synth-builder/bsb-label.ts` — static label
- [x] T427 [P] Create `instruments/blue-synth-builder/bsb-line-object.ts` — line/drawing
- [x] T428 Implement XML load (data-only, no replacement contribution)

### BSBGraphicInterface
- [x] T429 Create `instruments/blue-synth-builder/bsb-graphic-interface.ts` — root group, gridSettings
- [x] T430 [P] Implement `collectReplacements()` that delegates to root group
- [x] T431 Implement XML load with recursive bsbObject parsing (type dispatch for all 16 widget types)

### BlueSynthBuilder Instrument
- [x] T432 Create `instruments/blue-synth-builder.ts` — Instrument implementation
- [x] T433 [P] Parse: name, instrumentText, alwaysOnInstrumentText, globalOrc, globalSco, graphicInterface
- [x] T434 [P] Implement `generateInstrument()` — compilation unit + replaceBSBValues
- [x] T435 Implement `generateGlobalOrc()` and `generateGlobalSco()`
- [x] T436 [P] Implement XML load/save

---

## Phase 19: Arrangement Instrument Loading

### InstrumentAssignment Updates
- [x] T437 Update `InstrumentAssignment` to hold an `Instrument` reference (not just metadata)
- [x] T438 [P] Update `Arrangement.loadFromXML()` to parse embedded `<instrument>` elements
- [x] T439 Implement type dispatch: `type="blue.orchestra.BlueSynthBuilder"` → `BlueSynthBuilder.loadFromXML()`
- [x] T440 [P] Add `arrangementId` and `isEnabled` attribute parsing from XML

### Instrument Registry
- [x] T441 Create instrument type registry for XML dispatch (extensible for future instrument types)
- [x] T442 [P] Register BlueSynthBuilder in the registry

---

## Phase 20: BSB Compilation + CSD Generation

### Orchestra Generation
- [x] T443 Update `Arrangement.generateOrchestra()` to call `ia.instr.generateInstrument()` for loaded instruments
- [x] T444 [P] Wrap instrument text with `instr <arrangementId>\t;<name>\n...\n\tendin\n\n`
- [x] T445 Apply `<INSTR_ID>` and `<INSTR_NAME>` token replacement
- [x] T446 [P] Apply blueMixerOut → outc conversion

### Global Code Collection
- [x] T447 Update `CompileData` to collect globalOrc from all instruments
- [x] T448 [P] Update `CompileData` to collect globalSco from all instruments
- [x] T449 Update `BlueData.toCSD()` to emit globalOrc before instrument definitions
- [x] T450 [P] Update `BlueData.toCSD()` to emit globalSco before score events

### PianoRoll Integration
- [x] T451 Remove stub instrument generation from PianoRoll (BSB instruments now provide real orchestra)
- [x] T452 [P] Keep PianoRoll as fallback for projects without BSB instruments

---

## Phase 21: Integration + Testing

### End-to-End Testing
- [x] T453 [P] Test: Load `demo2022.blue`, verify BSB instruments are loaded (count > 0)
- [x] T454 [P] Test: Generate CSD, verify `<placeholder>` tokens are replaced with values
- [x] T455 [P] Test: Generate CSD, verify globalOrc contains mixer inits and string globals
- [x] T456 [P] Test: Generate CSD, verify instrument count matches Java Blue's output
- [x] T457 Integration: Play `demo2022.blue`, verify audio matches Java Blue output
- [x] T458 [P] Test: 115 existing tests still pass

### Edge Cases
- [x] T459 Handle missing widget values (use default 0.0)
- [x] T460 [P] Handle unknown BSB widget types (skip with warning)
- [x] T461 Handle empty instrumentText (return empty string)

---

## Phase Dependencies

- **Phase 18**: No dependencies. Can start immediately.
- **Phase 19**: Depends on Phase 18 (BSB data model + BlueSynthBuilder).
- **Phase 20**: Depends on Phase 19 (arrangement instrument loading).
- **Phase 21**: Depends on Phase 20 (CSD generation with real instruments).
