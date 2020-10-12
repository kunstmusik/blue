package blue.utility;

import java.io.File;
import javax.swing.filechooser.FileFilter;

/**
 * @author steven
 */
public class GenericFileFilter extends FileFilter {

    private final String[] extensions;

    private final String description;

    public GenericFileFilter(String extension, String description) {
        this(new String[] { extension }, description);
    }

    public GenericFileFilter(String[] extensions, String description) {
        this.extensions = extensions;

        for(int i = 0; i < extensions.length; i++) {
            extensions[i] = extensions[i].toLowerCase();
        }

        this.description = description;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.filechooser.FileFilter#accept(java.io.File)
     */
    @Override
    public boolean accept(File f) {
        if (f.isDirectory()) {
            return true;
        }

        String lowerName = f.getName().toLowerCase();

        for(String extension : extensions) {
            if(lowerName.endsWith(extension)) {
                return true;
            }
        }

        return false;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.filechooser.FileFilter#getDescription()
     */
    @Override
    public String getDescription() {
        return description;
    }

}
