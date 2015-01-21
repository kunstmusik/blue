/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.projects.actions;

import blue.projects.BlueProjectManager;
import blue.projects.recentProjects.RecentProjectsList;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.DynamicMenuContent;
import org.openide.util.HelpCtx;
import org.openide.util.NbBundle;
import org.openide.util.actions.CallableSystemAction;

/**
 *
 * Class adapted from article http://wiki.netbeans.org/AddingMRUList
 */
public class RecentProjectsAction extends CallableSystemAction {

    /** {@inheritDoc}
     * do nothing
     */
    public void performAction() {
        // do nothing
    }

    /** {@inheritDoc} */
    public String getName() {
        return NbBundle.getMessage(RecentProjectsAction.class, "CTL_RecentProjectsAction");
    }


    /** {@inheritDoc} */
    public HelpCtx getHelpCtx() {
        return HelpCtx.DEFAULT_HELP;
    }

    /** {@inheritDoc} */
    @Override
    protected boolean asynchronous() {
        return false;
    }

    /** {@inheritDoc}
     * Overide to provide SubMenu for MRUFiles (Most Recently Used Files)
     */
    @Override
    public JMenuItem getMenuPresenter() {
        JMenu menu = new MRUFilesMenu(getName());
        return menu;
    }



    class MRUFilesMenu extends JMenu implements DynamicMenuContent {

        public MRUFilesMenu(String s) {
            super(s);

            RecentProjectsList opts = RecentProjectsList.getInstance();
            opts.addPropertyChangeListener(new PropertyChangeListener() {
                public void propertyChange(PropertyChangeEvent evt) {
                    if (!evt.getPropertyName().equals(RecentProjectsList.MRU_FILE_LIST_PROPERTY)) {
                       return;
                    }
                    updateMenu();
                }
            });

            updateMenu();
        }

        public JComponent[] getMenuPresenters() {
            return new JComponent[] {this};
        }

        public JComponent[] synchMenuPresenters(JComponent[] items) {
            return getMenuPresenters();
        }

        private void updateMenu() {
            removeAll();
            RecentProjectsList opts = RecentProjectsList.getInstance();
            List<String> list = opts.getRecentProjectsList();
            for (int i=0; i<list.size(); i++ ) {
                String name = list.get(i);
                Action action = createAction(name);
                action.putValue(Action.NAME,name);
                JMenuItem menuItem = new JMenuItem(action);
                add(menuItem);
            }
        }


        private Action createAction(String actionCommand) {
            Action action = new AbstractAction() {
                public void actionPerformed(ActionEvent e) {
                    menuItemActionPerformed(e);
                }
            };

            action.putValue(Action.ACTION_COMMAND_KEY, actionCommand);
            return action;
        }

        private void menuItemActionPerformed(ActionEvent evt) {
            String command = evt.getActionCommand();
            File file = new File(command);


            if(BlueProjectManager.getInstance().findProjectFromFile(file) == null) {
                OpenProjectAction.open(file);
            } else {
                NotifyDescriptor nd =  new NotifyDescriptor.Message("This project is already open.", NotifyDescriptor.INFORMATION_MESSAGE);
                DialogDisplayer.getDefault().notify(nd);
            }
//            try {
//                DataObject data = DataObject.find(FileUtil.toFileObject(file));
//                OpenCookie cookie = data.getCookie(OpenCookie.class);
//                cookie.open();
//            } catch (Exception ex) {
//                NotifyDescriptor nd =  new NotifyDescriptor.Message(ex.getMessage(), NotifyDescriptor.ERROR_MESSAGE);
//                DialogDisplayer.getDefault().notify(nd);
//            }
        }
    }
}

