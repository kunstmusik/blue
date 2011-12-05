package skt.swing;

/**
 * MySwing: Advanced Swing Utilites
 * Copyright (C) 2005  Santhosh Kumar T
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 */

import javax.swing.*;
import java.awt.*;

public class SwingUtil{

    /*-------------------------------------------------[ Actions ]---------------------------------------------------*/

    public static void installActions(JComponent comp, Action actions[], int condition){
        ActionMap actionMap = comp.getActionMap();
        InputMap inputMap = comp.getInputMap(condition);
        for(int i = 0; i<actions.length; i++){
            String name = (String)actions[i].getValue(Action.NAME);
            actionMap.put(name, actions[i]);
            inputMap.put((KeyStroke)actions[i].getValue(Action.ACCELERATOR_KEY), name);
        }
    }

    public static void installActions(JComponent comp, Action actions[]){
        installActions(comp, actions, JComponent.WHEN_FOCUSED);
    }

    /*-------------------------------------------------[ Scrolling ]---------------------------------------------------*/

    public static boolean canHScroll(JViewport viewport){
        JScrollPane scrollPane = (JScrollPane)viewport.getParent();
        Rectangle availR = scrollPane.getBounds();

        Component view = viewport.getView();
        Dimension viewPrefSize = view!=null ? view.getPreferredSize() : new Dimension(0, 0);
        Dimension extentSize = viewport.toViewCoordinates(availR.getSize());

        boolean canHScroll = true;
        if(view instanceof Scrollable)
            canHScroll = !((Scrollable)view).getScrollableTracksViewportWidth();
        if(canHScroll && (viewPrefSize.width <= extentSize.width))
            canHScroll = false;

        return canHScroll;
    }

    public static boolean canVScroll(JViewport viewport){
        JScrollPane scrollPane = (JScrollPane)viewport.getParent();
        Rectangle availR = scrollPane.getBounds();

        Component view = viewport.getView();
        Dimension viewPrefSize = view!=null ? view.getPreferredSize() : new Dimension(0, 0);
        Dimension extentSize = viewport.toViewCoordinates(availR.getSize());

        boolean canVScroll = true;
        if(view instanceof Scrollable)
            canVScroll = !((Scrollable)view).getScrollableTracksViewportHeight();
        if(canVScroll && (viewPrefSize.height <= extentSize.height))
            canVScroll = false;

        return canVScroll;
    }

    public static boolean canScroll(JViewport viewport){
        return canHScroll(viewport) || canVScroll(viewport);
    }
}
