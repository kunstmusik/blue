/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectListener;
import java.awt.BorderLayout;
import java.beans.IntrospectionException;
import java.beans.PropertyChangeListener;
import javafx.collections.ObservableSet;
import javafx.collections.SetChangeListener;
import javax.swing.JComponent;
import org.openide.explorer.propertysheet.PropertySheetView;
import org.openide.nodes.BeanNode;
import org.openide.nodes.Node;
import org.openide.util.Exceptions;

/**
 * @author Steven Yi
 */
public class BSBObjectPropertySheet extends JComponent //        implements        BSBObjectListener 
{

    private PropertySheetView propSheet = new PropertySheetView();

    PropertyChangeListener pl;

    private BSBObjectView objectView;

    private boolean showAutomatable;
    private final ObservableSet<BSBObject> selection;

    SetChangeListener<BSBObject> scl;

    public BSBObjectPropertySheet(boolean showAutomatable, ObservableSet<BSBObject> selection) {

        this.showAutomatable = showAutomatable;
        this.selection = selection;

        this.setLayout(new BorderLayout());
        this.add(propSheet, BorderLayout.CENTER);

        // PropertyEditorRegistry registry = new PropertyEditorRegistry();
        //
        // registry.registerEditor(BSBDropdownView.class,
        // DropdownItemsPropertyEditor.class);
        //
        // propSheet.setEditorRegistry(registry);
        //
        // PropertyRendererRegistry renderRegistry = new
        // PropertyRendererRegistry();
        //
        // renderRegistry.registerRenderer(BSBDropdownItemList.class,
        // DefaultTableCellRenderer.class);
//        propSheet.setMode(PropertySheet.VIEW_AS_FLAT_LIST);
//        propSheet.setToolBarVisible(false);
//        propSheet.setDescriptionVisible(false);
        scl = change -> {
            if (selection.size() == 1) {
                try {
                    propSheet.setNodes(new Node[]{new BeanNode<BSBObject>(selection.iterator().next())});

                } catch (IntrospectionException ex) {
                    Exceptions.printStackTrace(ex);
                }
            } else {
                propSheet.setNodes(null);
            }
        };

    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        selection.removeListener(scl);
    }

    @Override
    public void addNotify() {
        super.addNotify();

        selection.addListener(scl);
    }

    /**
     *
     */
    public void clear() {
        propSheet.setNodes(null);
    }

}
