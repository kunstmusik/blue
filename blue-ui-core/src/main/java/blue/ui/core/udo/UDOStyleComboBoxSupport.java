package blue.ui.core.udo;

import blue.udo.UDOStyle;
import java.awt.Component;
import javax.swing.DefaultComboBoxModel;
import javax.swing.DefaultListCellRenderer;
import javax.swing.JComboBox;
import javax.swing.JList;

public final class UDOStyleComboBoxSupport {

    private UDOStyleComboBoxSupport() {
    }

    public static void configure(JComboBox<UDOStyle> comboBox) {
        comboBox.setModel(new DefaultComboBoxModel<>(UDOStyle.values()));
        comboBox.setRenderer(new DefaultListCellRenderer() {
            @Override
            public Component getListCellRendererComponent(JList<?> list,
                    Object value, int index, boolean isSelected,
                    boolean cellHasFocus) {
                Object displayValue = value instanceof UDOStyle style
                        ? getDisplayName(style)
                        : value;

                return super.getListCellRendererComponent(list, displayValue,
                        index, isSelected, cellHasFocus);
            }
        });
    }

    public static String getDisplayName(UDOStyle style) {
        return switch (style) {
            case CLASSIC -> "Classic";
            case MODERN -> "Modern";
        };
    }
}
