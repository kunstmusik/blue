package blue.soundObject.editor.pianoRoll;

import java.io.File;
import javax.swing.filechooser.FileFilter;

public final class ScalaFileFilter extends FileFilter {
    @Override
    public boolean accept(File f) {
        if (f.isDirectory()) {
            return true;
        }
        String extension = getExtension(f);

        return extension != null && extension.equals("scl");
    }

    @Override
    public String getDescription() {
        return "Scala File (*.scl)";
    }

    private String getExtension(File f) {
        String ext = null;
        String s = f.getName();
        int i = s.lastIndexOf('.');

        if (i > 0 && i < s.length() - 1) {
            ext = s.substring(i + 1).toLowerCase();
        }
        return ext;
    }
}