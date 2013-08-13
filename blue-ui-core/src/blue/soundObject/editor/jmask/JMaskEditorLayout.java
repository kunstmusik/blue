package blue.soundObject.editor.jmask;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;
import javax.swing.JViewport;

class JMaskEditorLayout implements LayoutManager {

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
            return new Dimension(0, 0);
        }
        if (parent.getParent() == null) {
            return new Dimension(0, 0);
        }

        int w = ((JViewport) parent.getParent()).getExtentSize().width;

        int h = 0;
        for (int i = 0; i < count; i++) {
            Component temp = parent.getComponent(i);

            if(temp.isVisible()) {
                h += temp.getPreferredSize().getHeight();
            }
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

        int w = ((JViewport) parent.getParent()).getExtentSize().width;

        int runningY = 0;
        for (int i = 0; i < count; i++) {
            Component temp = parent.getComponent(i);

            if(temp.isVisible()) {
                temp.setLocation(0, runningY);
                temp.setSize(w, (int) temp.getPreferredSize().getHeight());

                runningY += temp.getHeight();
            }
        }
    }
}
