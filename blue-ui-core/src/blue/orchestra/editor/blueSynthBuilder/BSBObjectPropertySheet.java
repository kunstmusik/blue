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

package blue.orchestra.editor.blueSynthBuilder;

import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectListener;
import com.l2fprod.common.propertysheet.Property;
import com.l2fprod.common.propertysheet.PropertySheet;
import com.l2fprod.common.propertysheet.PropertySheetPanel;
import java.awt.BorderLayout;
import java.beans.BeanInfo;
import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyDescriptor;
import javax.swing.JComponent;

/**
 * @author Steven Yi
 */
public class BSBObjectPropertySheet extends JComponent implements
        SelectionListener, BSBObjectListener {

    private PropertySheetPanel propSheet = new PropertySheetPanel();

    PropertyChangeListener pl;

    private BSBObjectView objectView;

    private boolean showAutomatable;

    public BSBObjectPropertySheet(boolean showAutomatable) {
        this.showAutomatable = showAutomatable;

        pl = new PropertyChangeListener() {

            @Override
            public void propertyChange(PropertyChangeEvent evt) {
                if (objectView != null) {
                    Property prop = (Property) evt.getSource();
                    prop.writeToObject(objectView);
                }
            }
        };

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

        propSheet.setMode(PropertySheet.VIEW_AS_FLAT_LIST);
        propSheet.setToolBarVisible(false);
        propSheet.setDescriptionVisible(false);

    }

    @Override
    public void selectionPerformed(SelectionEvent e) {
        if (e.getSelectionType() != SelectionEvent.SELECTION_SINGLE) {
            clear();
            return;
        }

        BSBObjectViewHolder objectViewHolder = (BSBObjectViewHolder) e
                .getSelectedItem();
        BSBObjectView objectView = objectViewHolder.getBSBObjectView();

        this.setEnabled(true);

        if (this.objectView != null) {
            this.objectView.removeBSBObjectListener(this);
        }

        this.objectView = objectView;

        BeanInfo beanInfo = null;

        String className = objectView.getClass().getName();
        try {
            beanInfo = (BeanInfo) Class.forName(className + "BeanInfo")
                    .newInstance();
        } catch (InstantiationException | IllegalAccessException | ClassNotFoundException e2) {

        }

        if (beanInfo == null) {

            try {
                beanInfo = Introspector.getBeanInfo(objectView.getClass(),
                        JComponent.class);
            } catch (IntrospectionException e1) {
                e1.printStackTrace();
            }
        }

        if (beanInfo == null) {
            return;
        }

        propSheet.removePropertySheetChangeListener(pl);

        // propSheet.setBeanInfo(beanInfo);

        PropertyDescriptor[] propertyDescriptors = beanInfo
                .getPropertyDescriptors();

        int index = -1;

        if (!showAutomatable) {
            for (int i = 0; i < propertyDescriptors.length; i++) {
                if (propertyDescriptors[i].getDisplayName().equals(
                        "automationAllowed")) {
                    index = i;
                    break;
                }
            }

            if (index > 0) {
                PropertyDescriptor[] temp = new PropertyDescriptor[propertyDescriptors.length - 1];

                for (int i = 0; i < propertyDescriptors.length; i++) {
                    if (i < index) {
                        temp[i] = propertyDescriptors[i];
                    } else if (i > index) {
                        temp[i - 1] = propertyDescriptors[i];
                    }
                }

                propertyDescriptors = temp;
            }
        }

        propSheet.setProperties(propertyDescriptors);
        propSheet.readFromObject(objectView);

        propSheet.addPropertySheetChangeListener(pl);
        objectView.addBSBObjectListener(this);
    }

    @Override
    public void bsbObjectChanged(BSBObject object) {
        propSheet.readFromObject(BSBObjectEditorFactory.getView(object));
    }

    /**
     * 
     */
    public void clear() {
        PropertyDescriptor[] blank = new PropertyDescriptor[0];
        propSheet.setProperties(blank);
    }

}