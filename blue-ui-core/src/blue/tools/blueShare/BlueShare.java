package blue.tools.blueShare;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 *
 * @author unascribed
 * @version 1.0
 */

import blue.BlueSystem;
import blue.tools.blueShare.effects.BlueShareEffectCategory;
import blue.tools.blueShare.instruments.BlueShareInstrumentCategory;
import blue.utility.GUI;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;
import java.awt.HeadlessException;
import java.io.File;
import java.io.IOException;
import javax.swing.JOptionPane;
import org.apache.xmlrpc.XmlRpcException;
import org.openide.windows.WindowManager;

public class BlueShare {
    private static BlueShareDialog dialog = null;

    private BlueShare() {
    }

    public static void runBlueShare() {

//        String server = selectServer();
//        if (server == null) {
//            // JOptionPane.showMessageDialog(null, BlueSystem
//            // .getString("blueShare.selectServer.error"), BlueSystem
//            // .getString("message.error"), JOptionPane.ERROR_MESSAGE);
//            return;
//        }

        String server = "http://blue.kunstmusik.com/blue_share/api";

        try {
            BlueShareRemoteCaller.setServer(server);
        } catch (java.net.MalformedURLException mue) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + mue.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        }

        BlueShareInstrumentCategory[] categories;
        BlueShareEffectCategory[] effectCategories;

        try {
            categories = BlueShareRemoteCaller.getInstrumentCategoryTree();
            effectCategories = BlueShareRemoteCaller.getEffectCategoryTree();
        } catch (ParseException pe) {
            String error = BlueSystem
                    .getString("blueShare.selectServer.couldNotReadResponse");
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            pe.printStackTrace();
            return;
        } catch (XmlRpcException xre) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + xre.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        } catch (IOException ioe) {
            String error = BlueSystem.getString("message.errorLabel") + " "
                    + ioe.getLocalizedMessage();
            JOptionPane.showMessageDialog(null, error, BlueSystem
                    .getString("message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        }

        if (dialog == null) {
            dialog = new BlueShareDialog(WindowManager.getDefault().getMainWindow(), true);
        }

        dialog.setInstrumentCategories(categories);
        dialog.setEffectCategories(effectCategories);

        dialog.setVisible(true);
    }

    private static String selectServer() {

        String retVal = null;

        // get server list from disk
        try {
            Document doc = new Document(new File(BlueSystem.getConfDir()
                    + File.separator + "blueShare.xml"));
            Element root = doc.getRoot();
            Elements servers = root.getElements("server");
            Object[] serverOptions = new Object[servers.size()];
            int i = 0;

            while (servers.hasMoreElements()) {
                serverOptions[i] = servers.next().getTextString();
                i++;
            }

            Object serverObj = JOptionPane.showInputDialog(null, BlueSystem
                    .getString("blueShare.selectServer.message"), BlueSystem
                    .getString("blueShare.selectServer.title"),
                    JOptionPane.PLAIN_MESSAGE, null, serverOptions,
                    serverOptions[0]);
            if (serverObj != null) {
                retVal = serverObj.toString();
            }
        } catch (ParseException | HeadlessException e) {
            e.printStackTrace();
        }

        return retVal;

    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        BlueShare.runBlueShare();
    }
}