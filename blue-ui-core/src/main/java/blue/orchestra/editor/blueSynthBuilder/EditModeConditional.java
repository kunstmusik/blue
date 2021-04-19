package blue.orchestra.editor.blueSynthBuilder;

import javafx.beans.property.BooleanProperty;

/**
 * Interface for BSBEditViews that should render differently depending upon
 * whether edit mode is enabled (e.g., BSBValue).
 *
 * @author stevenyi
 */
public interface EditModeConditional {
    public void setEditEnabledProperty(BooleanProperty editEnabled);
}
