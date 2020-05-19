/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score;

import java.awt.Component;
import java.awt.Container;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.ContainerEvent;
import java.awt.event.ContainerListener;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * Listens for all additions/removals and component size and movement changes
 * within a hierarchy
 *
 * @author Steven Yi
 */
public class ScoreNavigatorContainerListener implements ContainerListener, ComponentListener {

    private final ChangeListener cl;

    public ScoreNavigatorContainerListener(ChangeListener cl) {
        this.cl = cl;
    }

    public void install(Component c) {
        c.addComponentListener(this);

        if (c instanceof Container) {
            Container container = (Container) c;
            container.addContainerListener(this);
            for (var comp : container.getComponents()) {

                install(comp);
            }
        }

    }

    public void uninstall(Component c) {
        c.removeComponentListener(this);

        if (c instanceof Container) {
            Container container = (Container) c;
            container.removeContainerListener(this);
            for (var comp : container.getComponents()) {
                uninstall(comp);
            }
        }
    }

    @Override
    public void componentAdded(ContainerEvent e) {
        Component c = e.getChild();
        install(c);
        if (this.cl != null) {
            cl.stateChanged(new ChangeEvent(this));
        }
    }

    @Override
    public void componentRemoved(ContainerEvent e) {
        Component c = e.getChild();
        uninstall(c);
        if (this.cl != null) {
            cl.stateChanged(new ChangeEvent(this));
        }
    }

    @Override
    public void componentResized(ComponentEvent e) {
        if (this.cl != null) {
            cl.stateChanged(new ChangeEvent(e.getComponent()));
        }
    }

    @Override
    public void componentMoved(ComponentEvent e) {
        if (this.cl != null) {
            cl.stateChanged(new ChangeEvent(e.getComponent()));
        }
    }

    @Override
    public void componentShown(ComponentEvent e) {

    }

    @Override
    public void componentHidden(ComponentEvent e) {

    }

}
