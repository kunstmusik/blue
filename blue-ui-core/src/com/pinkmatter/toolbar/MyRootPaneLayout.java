package com.pinkmatter.toolbar;

import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.LayoutManager2;
import java.awt.Rectangle;
import javax.swing.JComponent;
import javax.swing.JMenuBar;
import javax.swing.JRootPane;

/**
 *
 * Grabbed from http://netbeans.dzone.com/how-create-tabbed-toolbar-on-nb
 * 
 * @author Chris
 */

public class MyRootPaneLayout implements LayoutManager2 {

    private JComponent _toolbar;

    public MyRootPaneLayout(JComponent toolbar) {
        _toolbar = toolbar;
    }

    @Override
    public Dimension preferredLayoutSize(Container parent) {
        int contentWidth = 0;
        int menuWidth = 0;
        int height = 0;

        Insets insets = parent.getInsets();
        height += insets.top + insets.bottom;

        JRootPane rootPane = (JRootPane) parent;

        Dimension contentSize;
        if (rootPane.getContentPane() != null) {
            contentSize = rootPane.getContentPane().getPreferredSize();
        } else {
            contentSize = rootPane.getSize();
        }
        contentWidth = contentSize.width;
        height += contentSize.height;

        if (rootPane.getJMenuBar() != null) {
            Dimension menuSize = rootPane.getJMenuBar().getPreferredSize();
            height += menuSize.height;
            menuWidth = menuSize.width;
        }

        return new Dimension(Math.max(contentWidth, menuWidth) + insets.left + insets.right, height);
    }

    @Override
    public Dimension minimumLayoutSize(Container parent) {
        int contentWidth = 0;
        int menuWidth = 0;
        int height = 0;

        Insets insets = parent.getInsets();
        height += insets.top + insets.bottom;

        JRootPane rootPane = (JRootPane) parent;

        Dimension contentSize;
        if (rootPane.getContentPane() != null) {
            contentSize = rootPane.getContentPane().getMinimumSize();
        } else {
            contentSize = rootPane.getSize();
        }
        contentWidth = contentSize.width;
        height += contentSize.height;

        if (rootPane.getJMenuBar() != null) {
            Dimension menuSize = rootPane.getJMenuBar().getMinimumSize();
            height += menuSize.height;
            menuWidth = menuSize.width;
        }

        return new Dimension(Math.max(contentWidth, menuWidth) + insets.left + insets.right, height);
    }

    @Override
    public Dimension maximumLayoutSize(Container target) {
        return new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE);
    }

    @Override
    public void layoutContainer(Container parent) {
        JRootPane rootPane = (JRootPane) parent;
        Rectangle bounds = rootPane.getBounds();
        Insets insets = rootPane.getInsets();
        int y = insets.top;
        int x = insets.left;
        int w = bounds.width - insets.right - insets.left;
        int h = bounds.height - insets.top - insets.bottom;

        if (rootPane.getLayeredPane() != null) {
            rootPane.getLayeredPane().setBounds(x, y, w, h);
        }

        if (rootPane.getGlassPane() != null) {
            rootPane.getGlassPane().setBounds(x, y, w, h);
        }

        if (rootPane.getJMenuBar() != null) {
            JMenuBar menu = rootPane.getJMenuBar();
            Dimension size = menu.getPreferredSize();
            menu.setBounds(x, y, w, size.height);
            y += size.height;
        }


        int height = h - y - 70;

        if (rootPane.getContentPane() != null) {
            
            if (height < 0) {
                height = 0;
            }
            rootPane.getContentPane().setBounds(x, y, w, height);
        }
        
        if (_toolbar != null) {
            Dimension size = _toolbar.getPreferredSize();
            _toolbar.setBounds(x, y + height, w, size.height);
            y += size.height;
        }
    }

    @Override
    public void addLayoutComponent(String name, Component comp) {
    }

    @Override
    public void removeLayoutComponent(Component comp) {
    }

    @Override
    public void addLayoutComponent(Component comp, Object constraints) {
    }

    @Override
    public float getLayoutAlignmentX(Container target) {
        return 0.0f;
    }

    @Override
    public float getLayoutAlignmentY(Container target) {
        return 0.0f;
    }

    @Override
    public void invalidateLayout(Container target) {
    }
    
}
