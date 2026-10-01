# SMPTE timecode correction

Blue now separates the project physical frame rate from non-drop (NDF) and drop-frame (DF) counting. Fractional rates use exact rational values; DF is available at 29.97 and 59.94. Rulers, transport, marker and score-object fields use the same project format.

At 29.97 DF, `00:00:59;29` advances to `00:01:00;02`; `00:09:59;29` advances to `00:10:00;00`. DF skips label numbers, not media. NDF uses colons and DF requires a semicolon before frames. Invalid and skipped labels are rejected. Hours beyond 23 remain visible without wrapping.

Legacy projects without explicit mode open as NDF. Corrected 29.97 NDF displays 60 elapsed seconds as `00:00:59:28`, and entry `00:01:00:00` means 60.060 seconds. Earlier Blue arithmetic interpreted fractional-rate labels differently. Existing stored timing stays unchanged; newly entered text uses corrected meanings. Frame snap follows physical elapsed-time frames through tempo changes, independently of mode. Audio sample frames are unchanged.

Format is saved with the project, copied, and undoable. New-project defaults include mode; existing projects retain their saved format.
