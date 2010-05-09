package blue.ui.core.mixer;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;

class ChannelListLayout implements LayoutManager {

    private final int widthAdjustment;

    public ChannelListLayout() {
        this(0);
    }

    public ChannelListLayout(int widthAdjustment) {
        this.widthAdjustment = widthAdjustment;
    }

    public void addLayoutComponent(String name, Component comp) {
    }

    public void removeLayoutComponent(Component comp) {
    }

    public Dimension preferredLayoutSize(Container parent) {
        return minimumLayoutSize(parent);
    }

    public Dimension minimumLayoutSize(Container parent) {
        int count = parent.getComponentCount();
        if (count == 0) {
            return new Dimension(0, 0);
        }

        if (parent.getParent() == null) {
            return new Dimension(0, 0);
        }

        Component c = parent.getComponent(0);

        Dimension size = c.getPreferredSize();

        int w = (count * size.width) + widthAdjustment;

        int h = size.height > parent.getParent().getHeight() ? size.height
                : parent.getParent().getHeight();

        return new Dimension(w, h);
    }

    public void layoutContainer(Container parent) {
        int count = parent.getComponentCount();
        if (count == 0) {
            return;
        }

        if (parent.getParent() == null) {
            return;
        }

        Component c = parent.getComponent(0);

        Dimension size = c.getPreferredSize();

        int h = size.height > parent.getParent().getHeight() ? size.height
                : parent.getParent().getHeight();

        for (int i = 0; i < count; i++) {
            Component temp = parent.getComponent(i);

            temp.setLocation(size.width * i, 0);
            temp.setSize(size.width, h);
        }
    }

}