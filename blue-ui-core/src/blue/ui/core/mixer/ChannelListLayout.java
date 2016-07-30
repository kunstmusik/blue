package blue.ui.core.mixer;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import javax.swing.JViewport;

class ChannelListLayout implements LayoutManager {

    private final int widthAdjustment;

    public ChannelListLayout() {
        this(0);
    }

    public ChannelListLayout(int widthAdjustment) {
        this.widthAdjustment = widthAdjustment;
    }

    @Override
    public void addLayoutComponent(String name, Component comp) {
    }

    @Override
    public void removeLayoutComponent(Component comp) {
    }

    @Override
    public Dimension preferredLayoutSize(Container parent) {
        return minimumLayoutSize(parent);
    }

    @Override
    public Dimension minimumLayoutSize(Container parent) {
        int count = parent.getComponentCount();
        if (count == 0) {
            return new Dimension(widthAdjustment, 0);
        }

        if (parent.getParent() == null) {
            return new Dimension(widthAdjustment, 0);
        }

        Component topHeightComponent = parent;

        while (!(topHeightComponent instanceof JViewport)) {
            topHeightComponent = topHeightComponent.getParent();
        }

        int w = widthAdjustment;
        int h = Integer.MIN_VALUE;

        for (int i = 0; i < parent.getComponentCount(); i++) {
            Dimension tempSize = parent.getComponent(i).getPreferredSize();
            w += tempSize.width;

            if (tempSize.height > h) {
                h = tempSize.height;
            }
        }

        if (h < topHeightComponent.getHeight()) {
            h = topHeightComponent.getHeight();
        }

        return new Dimension(w, h);
    }

    @Override
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

        Component topHeightComponent = parent;

        while (!(topHeightComponent instanceof JViewport)) {
            topHeightComponent = topHeightComponent.getParent();
        }

        int h = Integer.MIN_VALUE;
        for (int i = 0; i < parent.getComponentCount(); i++) {
            Dimension tempSize = parent.getComponent(i).getPreferredSize();
            if (tempSize.height > h) {
                h = tempSize.height;
            }
        }

        if (h < topHeightComponent.getHeight()) {
            h = topHeightComponent.getHeight();
        }

        int x = 0;

        for (int i = 0; i < count; i++) {
            Component temp = parent.getComponent(i);

            Dimension tempSize = temp.getPreferredSize();

            temp.setLocation(x, 0);
            temp.setSize(tempSize.width, h);

            x += tempSize.width;
        }
    }

}
