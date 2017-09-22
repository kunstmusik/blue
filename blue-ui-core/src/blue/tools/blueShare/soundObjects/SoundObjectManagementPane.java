package blue.tools.blueShare.soundObjects;

import blue.BlueSystem;
import blue.tools.blueShare.BlueShareRemoteCaller;
import blue.tools.blueShare.NamePasswordPanel;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.io.IOException;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import org.apache.xmlrpc.XmlRpcException;

public class SoundObjectManagementPane extends JComponent {

    NamePasswordPanel namePasswordPanel = new NamePasswordPanel();

    CardLayout cardLayout = new CardLayout();

    JTable soundObjectTable = new JTable();

    SoundObjectManagementTableModel iTableModel = new SoundObjectManagementTableModel();

    JButton fetchSoundObjectsButton = new JButton("Fetch SoundObjects");

    JButton removeSoundObjectButton = new JButton("Remove SoundObject");

    JButton updateSoundObjectButton = new JButton(BlueSystem
            .getString("blueShare.update"));

    JPanel cardPanel;

    public SoundObjectManagementPane() {
        this.setLayout(new BorderLayout());
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        this.add(namePasswordPanel, BorderLayout.NORTH);

        soundObjectTable.setModel(iTableModel);

        // JSplitPane mainSplit = new JSplitPane();

        cardPanel = new JPanel(cardLayout);

        JScrollPane jsp = new JScrollPane();
        jsp.setViewportView(soundObjectTable);

        cardPanel.add(new JLabel("No SoundObjects for user."), "none");
        cardPanel.add(jsp, "soundObjects");

        this.add(cardPanel, BorderLayout.CENTER);

        // mainSplit.add(jsp, JSplitPane.LEFT);
        // mainSplit.add(jsp, JSplitPane.RIGHT);

        // this.add(mainSplit, BorderLayout.CENTER);

        fetchSoundObjectsButton.addActionListener((ActionEvent e) -> {
            fetchSoundObjects();
        });

        removeSoundObjectButton.addActionListener((ActionEvent e) -> {
            removeSoundObject();
        });

        /*
         * updateSoundObjectButton.addActionListener(new ActionListener() {
         * public void actionPerformed(ActionEvent e) { updateSoundObject(); }
         * });
         */

        JPanel buttonPanel = new JPanel();
        buttonPanel.add(fetchSoundObjectsButton);
        buttonPanel.add(removeSoundObjectButton);
        // buttonPanel.add(updateSoundObjectButton);

        this.add(buttonPanel, BorderLayout.SOUTH);

        cardLayout.show(cardPanel, "soundObjects");
    }

    protected void removeSoundObject() {
        SoundObjectOption iOption = iTableModel
                .getSoundObjectOption(soundObjectTable.getSelectedRow());

        if (iOption == null) {
            return;
        }

        int retVal = JOptionPane.showConfirmDialog(null, 
                "Are you sure you would like to remove this SoundObject from BlueShare?");
        if (retVal != JOptionPane.YES_OPTION) {
            return;
        }

        String username = namePasswordPanel.getUsername();
        String password = namePasswordPanel.getPassword();

        try {
            boolean success = BlueShareRemoteCaller.removeSoundObject(username,
                    password, iOption.getSoundObjectId());
        } catch (XmlRpcException | IOException xre) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            return;
        }
        JOptionPane.showMessageDialog(null,
                "SoundObject was successfully removed.", "Success",
                JOptionPane.PLAIN_MESSAGE);

        fetchSoundObjects();
    }

    protected void updateSoundObject() {
        SoundObjectOption iOption = iTableModel
                .getSoundObjectOption(soundObjectTable.getSelectedRow());

        if (iOption == null) {
            return;
        }

        JOptionPane.showMessageDialog(null,
                "Diagram and figure out best implementation");

        /*
         * int retVal = JOptionPane.showConfirmDialog(null, "Are you sure you
         * would like to remove this soundObject?"); if(retVal !=
         * JOptionPane.YES_OPTION) { return; }
         * 
         * String username = namePasswordPanel.getUsername(); String password =
         * namePasswordPanel.getPassword();
         * 
         * try { boolean success = BlueShareRemoteCaller.removeSoundObject(
         * username, password, iOption.getSoundObjectId()); } catch
         * (XmlRpcException xre) { String error =
         * BlueSystem.getString("message.errorLabel") + " " +
         * xre.getLocalizedMessage(); JOptionPane.showMessageDialog( null,
         * error, BlueSystem.getString("message.error"),
         * JOptionPane.ERROR_MESSAGE); iTableModel.setSoundObjectOptions(null);
         * return; } catch (IOException ioe) { String error =
         * BlueSystem.getString("message.errorLabel") + " " +
         * ioe.getLocalizedMessage(); JOptionPane.showMessageDialog( null,
         * error, BlueSystem.getString("message.error"),
         * JOptionPane.ERROR_MESSAGE); iTableModel.setSoundObjectOptions(null);
         * return; } JOptionPane.showMessageDialog( null, "SoundObject was
         * successfully removed.", "Success", JOptionPane.PLAIN_MESSAGE);
         * 
         * fetchSoundObjects();
         */
    }

    protected void fetchSoundObjects() {
        String username = namePasswordPanel.getUsername();
        String password = namePasswordPanel.getPassword();

        try {
            SoundObjectOption[] iOptions = BlueShareRemoteCaller
                    .getSoundObjectOptionsForUser(username, password);
            iTableModel.setSoundObjectOptions(iOptions);

            if (iOptions.length == 0) {
                cardLayout.show(cardPanel, "none");
            } else {
                cardLayout.show(cardPanel, "soundObjects");
            }

        } catch (ParseException pe) {
            String error = BlueSystem
                    .getString("blueShare.selectServer.couldNotReadResponse");
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            return;
        } catch (XmlRpcException xre) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            return;
        } catch (IOException ioe) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            iTableModel.setSoundObjectOptions(null);
            return;
        }
    }

    public static void main(String[] args) {
        blue.utility.GUI.showComponentAsStandalone(new SoundObjectManagementPane(), "SoundObjectManagementPane",
                true);
    }
}