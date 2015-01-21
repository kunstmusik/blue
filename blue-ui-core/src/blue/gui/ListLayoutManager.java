/**
 * 
 */
package blue.gui;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.LayoutManager;

/**
 *
 * @author syi
 */
public class ListLayoutManager implements LayoutManager {

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

        int w = parent.getWidth();

        int h = 0;

        for (int i = 0; i < count; i++) {
            final Component component = parent.getComponent(i);
            
            if(component.isVisible()) {
                h += component.getPreferredSize().height;
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

        int w = parent.getWidth();

        int runningY = 0;

        for (int i = 0; i < count; i++) {
            Component temp = parent.getComponent(i);

            if(temp.isVisible()) {
                int h = temp.getPreferredSize().height;

                temp.setLocation(0, runningY);
                temp.setSize(w, h);

                runningY += h;
            }
        }
    }
}
