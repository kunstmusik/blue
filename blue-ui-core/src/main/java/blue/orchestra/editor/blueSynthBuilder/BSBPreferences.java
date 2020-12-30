/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.editor.blueSynthBuilder;

import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import org.openide.util.Exceptions;
import org.openide.util.NbPreferences;

/**
 *
 * @author stevenyi
 */
public class BSBPreferences {

    private static final Preferences prefs = NbPreferences.forModule(
            BSBPreferences.class);

    private static BSBPreferences INSTANCE = null;

    public BooleanProperty showWidgetComments;

    private BSBPreferences() {
        var val = prefs.getBoolean("showWidgetComments", true);
        showWidgetComments = new SimpleBooleanProperty(val);

        showWidgetComments.addListener((obs, old, newVal) -> {
            save();
        });
    }

    public static BSBPreferences getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new BSBPreferences();
        }
        return INSTANCE;
    }

    public boolean getShowWidgetComments() {
        return showWidgetComments.get();
    }

    public void setShowWidgetComments(boolean showWidgetComments) {
        this.showWidgetComments.set(showWidgetComments);
    }
    
    public BooleanProperty showWidgetCommentsProperty() {
        return showWidgetComments;
    }
    

    protected void save() {
        final Preferences prefs = NbPreferences.forModule(
                BSBPreferences.class);

        prefs.putBoolean("showWidgetComments", getShowWidgetComments());

        try {
            prefs.sync();
        } catch (BackingStoreException ex) {
            Exceptions.printStackTrace(ex);
        }

    }
}
