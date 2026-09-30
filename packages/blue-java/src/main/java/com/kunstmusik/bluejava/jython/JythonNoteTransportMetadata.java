package com.kunstmusik.bluejava.jython;

import java.util.Collections;
import java.util.Map;
import java.util.WeakHashMap;

/** Opaque render metadata carried beside Jython notes across the runtime bridge. */
public final class JythonNoteTransportMetadata {
    private static final Map<JythonNote, String> RENDER_METADATA_IDS =
            Collections.synchronizedMap(new WeakHashMap<>());

    private JythonNoteTransportMetadata() {
    }

    public static void setRenderMetadataId(JythonNote note, String id) {
        if (id == null || id.isBlank()) {
            RENDER_METADATA_IDS.remove(note);
        } else {
            RENDER_METADATA_IDS.put(note, id);
        }
    }

    public static String getRenderMetadataId(JythonNote note) {
        return RENDER_METADATA_IDS.get(note);
    }

    static void copyRenderMetadataId(JythonNote source, JythonNote target) {
        String id = getRenderMetadataId(source);
        if (id != null) {
            setRenderMetadataId(target, id);
        }
    }
}
