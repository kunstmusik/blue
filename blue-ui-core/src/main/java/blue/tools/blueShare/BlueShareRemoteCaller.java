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

import blue.mixer.Effect;
import blue.orchestra.Instrument;
import blue.soundObject.SoundObject;
import blue.tools.blueShare.effects.BlueShareEffectCategory;
import blue.tools.blueShare.effects.EffectOption;
import blue.tools.blueShare.instruments.BlueShareInstrumentCategory;
import blue.tools.blueShare.instruments.InstrumentOption;
import blue.tools.blueShare.soundObjects.BlueShareSoundObjectCategory;
import blue.tools.blueShare.soundObjects.SoundObjectOption;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;
import java.io.IOException;
import java.util.HashMap;
import java.util.Vector;
import org.apache.xmlrpc.XmlRpcClient;
import org.apache.xmlrpc.XmlRpcException;

public class BlueShareRemoteCaller {
    private static XmlRpcClient xrpc;

    public static void setServer(String server)
            throws java.net.MalformedURLException {
        xrpc = new XmlRpcClient(server);
    }

    public static BlueShareInstrumentCategory[] getInstrumentCategoryTree()
            throws IOException, XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        result = (String) xrpc
                .execute("blueShare.getInstrumentCategoryTree", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        return getSubCategories(root);
    }

    private static BlueShareInstrumentCategory[] getSubCategories(Element parent) {
        Elements categories = parent.getElements();

        BlueShareInstrumentCategory[] iCategories = new BlueShareInstrumentCategory[categories
                .size()];
        int i = 0;
        int catId;
        String name;
        Element temp;
        BlueShareInstrumentCategory[] tempCategories;

        while (categories.hasMoreElements()) {
            temp = categories.next();
            catId = Integer.parseInt(temp.getAttribute("instrumentCategoryId"));
            name = temp.getAttribute("name");
            // description = temp.getElement("description").getTextString();
            tempCategories = getSubCategories(temp);

            iCategories[i] = new BlueShareInstrumentCategory(catId, name, null,
                    tempCategories);
            i++;
        }
        return iCategories;
    }

    public static InstrumentOption[] getLatestTenInstruments()
            throws XmlRpcException, IOException, ParseException {

        String result = (String) xrpc.execute("blueShare.getLatestTen",
                new Vector());

        Document doc = new Document(result);
        Element root = doc.getRoot();
        Elements instruments = root.getElements("instrument");

        InstrumentOption[] iOptions = new InstrumentOption[instruments.size()];
        int i = 0;
        int instrumentId;
        String screenName, name, type, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            instrumentId = Integer.parseInt(temp.getAttribute("instrumentId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new InstrumentOption(instrumentId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;

    }

    public static InstrumentOption[] getInstrumentOptions(
            BlueShareInstrumentCategory iCategory) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(new Integer(iCategory.getCategoryId()));

        result = (String) xrpc.execute("blueShare.getInstrumentList", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements instruments = root.getElements("instrument");

        InstrumentOption[] iOptions = new InstrumentOption[instruments.size()];
        int i = 0;
        int instrumentId;
        String screenName, name, type, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            instrumentId = Integer.parseInt(temp.getAttribute("instrumentId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new InstrumentOption(instrumentId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;
    }

    public static InstrumentOption[] getInstrumentOptionsForUser(
            String username, String password) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(username);
        v.add(password);

        result = (String) xrpc.execute("blueShare.getInstrumentListForUser", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements instruments = root.getElements("instrument");

        InstrumentOption[] iOptions = new InstrumentOption[instruments.size()];
        int i = 0;
        int instrumentId;
        String screenName, name, type, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            instrumentId = Integer.parseInt(temp.getAttribute("instrumentId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new InstrumentOption(instrumentId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;
    }

    public static Instrument getInstrument(InstrumentOption iOption)
            throws IOException, XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;

        v.add(new Integer(iOption.getInstrumentId()));

        result = (String) xrpc.execute("blueShare.getInstrument", v);

        Instrument instrument = null;

        try {
            Document d = new Document(result);
            instrument = (Instrument) ObjectUtilities.loadFromXML(d.getRoot());
        } catch (Exception e) {
        }

        // FIXME - analyze what instruments may be in BlueShare that would require
        // this and handle
//        if (instrument == null) {
//            try {
//                XMLSerializer xmlSer = new XMLSerializer();
//                BufferedReader reader = new BufferedReader(new StringReader(
//                        result));
//                instrument = (Instrument) xmlSer.read(reader);
//                return instrument;
//            } catch (IOException | ClassNotFoundException | IllegalAccessException | InstantiationException | InvocationTargetException e) {
//                e.printStackTrace();
//            }
//        }

        return instrument;

    }

    public static boolean submitInstrument(String username, String password,
            int categoryId, String name, String instrumentType,
            String description, String instrumentText) throws IOException,
            XmlRpcException {

        Vector v = new Vector();

        v.add(username);
        v.add(password);
        v.add(new Integer(categoryId));
        v.add(name);
        v.add(instrumentType);
        v.add(description);
        v.add(instrumentText);

        String result;

        result = (String) xrpc.execute("blueShare.submitInstrument", v);

        return true;
    }

    public static boolean removeInstrument(String username, String password,
            int instrumentId) throws XmlRpcException, IOException {

        Vector v = new Vector();
        v.add(username);
        v.add(password);
        v.add(new Integer(instrumentId));

        return (Boolean)xrpc.execute("blueShare.removeInstrument", v);
    }

    /* EFFECT METHODS */

    public static BlueShareEffectCategory[] getEffectCategoryTree()
            throws IOException, XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        result = (String) xrpc.execute("blueShare.getEffectCategoryTree", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        return getEffectSubCategories(root);
    }

    private static BlueShareEffectCategory[] getEffectSubCategories(
            Element parent) {
        Elements categories = parent.getElements();

        BlueShareEffectCategory[] iCategories = new BlueShareEffectCategory[categories
                .size()];
        int i = 0;
        int catId;
        String name;
        Element temp;
        BlueShareEffectCategory[] tempCategories;

        while (categories.hasMoreElements()) {
            temp = categories.next();
            catId = Integer.parseInt(temp.getAttribute("effectCategoryId"));
            name = temp.getAttribute("name");
            // description = temp.getElement("description").getTextString();
            tempCategories = getEffectSubCategories(temp);

            iCategories[i] = new BlueShareEffectCategory(catId, name, null,
                    tempCategories);
            i++;
        }
        return iCategories;
    }

    public static EffectOption[] getLatestTenEffects() throws XmlRpcException,
            IOException, ParseException {

        String result = (String) xrpc.execute("blueShare.getLatestTenEffects",
                new Vector());

        Document doc = new Document(result);
        Element root = doc.getRoot();
        Elements instruments = root.getElements("effect");

        EffectOption[] effectOptions = new EffectOption[instruments.size()];
        int i = 0;
        int effectId;
        String screenName, name, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            effectId = Integer.parseInt(temp.getAttribute("effectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();

            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            effectOptions[i] = new EffectOption(effectId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(description), checkNullString(category));
            i++;
        }
        return effectOptions;

    }

    public static EffectOption[] getEffectOptions(
            BlueShareEffectCategory iCategory) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(new Integer(iCategory.getCategoryId()));

        result = (String) xrpc.execute("blueShare.getEffectList", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements instruments = root.getElements("effect");

        EffectOption[] effectOptions = new EffectOption[instruments.size()];
        int i = 0;
        int instrumentId;
        String screenName, name, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            instrumentId = Integer.parseInt(temp.getAttribute("effectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();

            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            effectOptions[i] = new EffectOption(instrumentId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(description), checkNullString(category));
            i++;
        }
        return effectOptions;
    }

    public static EffectOption[] getEffectOptionsForUser(String username,
            String password) throws IOException, XmlRpcException,
            ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(username);
        v.add(password);

        result = (String) xrpc.execute("blueShare.getEffectListForUser", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements instruments = root.getElements("effect");

        EffectOption[] iOptions = new EffectOption[instruments.size()];
        int i = 0;
        int effectId;
        String screenName, name, description, category;
        Element temp;

        while (instruments.hasMoreElements()) {
            temp = instruments.next();
            effectId = Integer.parseInt(temp.getAttribute("effectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new EffectOption(effectId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(description), checkNullString(category));
            i++;
        }
        return iOptions;
    }

    public static Effect getEffect(EffectOption iOption) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;

        v.add(new Integer(iOption.getInstrumentId()));

        result = (String) xrpc.execute("blueShare.getEffect", v);

        Effect effect = null;

        try {
            Document d = new Document(result);
            effect = Effect.loadFromXML(d.getRoot());
        } catch (Exception e) {
        }

        return effect;

    }

    public static boolean submitEffect(String username, String password,
            int categoryId, String name, String description,
            String instrumentText) throws IOException, XmlRpcException {

        Vector v = new Vector();

        v.add(username);
        v.add(password);
        v.add(new Integer(categoryId));
        v.add(name);
        v.add(description);
        v.add(instrumentText);

        String result;

        result = (String) xrpc.execute("blueShare.submitEffect", v);

        return true;
    }

    public static boolean removeEffect(String username, String password,
            int effectId) throws XmlRpcException, IOException {

        Vector v = new Vector();
        v.add(username);
        v.add(password);
        v.add(new Integer(effectId));

        return (Boolean) xrpc.execute("blueShare.removeEffect", v);
    }


    /* SOUNDOBJECT METHODS */

        public static BlueShareSoundObjectCategory[] getSoundObjectCategoryTree()
            throws IOException, XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        result = (String) xrpc
                .execute("blueShare.getSoundObjectCategoryTree", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        return getSoundObjectSubCategories(root);
    }

    private static BlueShareSoundObjectCategory[] getSoundObjectSubCategories(Element parent) {
        Elements categories = parent.getElements();

        BlueShareSoundObjectCategory[] iCategories = new BlueShareSoundObjectCategory[categories
                .size()];
        int i = 0;
        int catId;
        String name;
        Element temp;
        BlueShareSoundObjectCategory[] tempCategories;

        while (categories.hasMoreElements()) {
            temp = categories.next();
            catId = Integer.parseInt(temp.getAttribute("soundObjectCategoryId"));
            name = temp.getAttribute("name");
            // description = temp.getElement("description").getTextString();
            tempCategories = getSoundObjectSubCategories(temp);

            iCategories[i] = new BlueShareSoundObjectCategory(catId, name, null,
                    tempCategories);
            i++;
        }
        return iCategories;
    }

    public static SoundObjectOption[] getLatestTenSoundObjects()
            throws XmlRpcException, IOException, ParseException {

        String result = (String) xrpc.execute("blueShare.getLatestTenSoundObjects",
                new Vector());

        Document doc = new Document(result);
        Element root = doc.getRoot();
        Elements soundObjects = root.getElements("soundObject");

        SoundObjectOption[] iOptions = new SoundObjectOption[soundObjects.size()];
        int i = 0;
        int soundObjectId;
        String screenName, name, type, description, category;
        Element temp;

        while (soundObjects.hasMoreElements()) {
            temp = soundObjects.next();
            soundObjectId = Integer.parseInt(temp.getAttribute("soundObjectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new SoundObjectOption(soundObjectId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;

    }

    public static SoundObjectOption[] getSoundObjectOptions(
            BlueShareSoundObjectCategory iCategory) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(new Integer(iCategory.getCategoryId()));

        result = (String) xrpc.execute("blueShare.getSoundObjectList", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements soundObjects = root.getElements("soundObject");

        SoundObjectOption[] iOptions = new SoundObjectOption[soundObjects.size()];
        int i = 0;
        int soundObjectId;
        String screenName, name, type, description, category;
        Element temp;

        while (soundObjects.hasMoreElements()) {
            temp = soundObjects.next();
            soundObjectId = Integer.parseInt(temp.getAttribute("soundObjectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new SoundObjectOption(soundObjectId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;
    }

    public static SoundObjectOption[] getSoundObjectOptionsForUser(
            String username, String password) throws IOException,
            XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;
        Document doc;

        v.add(username);
        v.add(password);

        result = (String) xrpc.execute("blueShare.getSoundObjectListForUser", v);
        doc = new Document(result);

        Element root = doc.getRoot();
        Elements soundObjects = root.getElements("soundObject");

        SoundObjectOption[] iOptions = new SoundObjectOption[soundObjects.size()];
        int i = 0;
        int soundObjectId;
        String screenName, name, type, description, category;
        Element temp;

        while (soundObjects.hasMoreElements()) {
            temp = soundObjects.next();
            soundObjectId = Integer.parseInt(temp.getAttribute("soundObjectId"));
            screenName = temp.getElement("screenName").getTextString();
            name = temp.getElement("name").getTextString();
            type = temp.getElement("type").getTextString();
            description = temp.getElement("description").getTextString();
            category = temp.getElement("category").getTextString();

            iOptions[i] = new SoundObjectOption(soundObjectId,
                    checkNullString(screenName), checkNullString(name),
                    checkNullString(type), checkNullString(description),
                    checkNullString(category));
            i++;
        }
        return iOptions;
    }

    public static SoundObject getSoundObject(SoundObjectOption iOption)
            throws IOException, XmlRpcException, ParseException {
        Vector v = new Vector();
        String result;

        v.add(new Integer(iOption.getSoundObjectId()));

        result = (String) xrpc.execute("blueShare.getSoundObject", v);

        SoundObject soundObject = null;

        try {
            Document d = new Document(result);
            soundObject = (SoundObject) ObjectUtilities.loadFromXML(d.getRoot(),
                    new HashMap<>());
        } catch (Exception e) {
        }

        // FIXME - analyze what instruments may be in BlueShare that would require
        // this and handle
//        if (instrument == null) {
//            try {
//                XMLSerializer xmlSer = new XMLSerializer();
//                BufferedReader reader = new BufferedReader(new StringReader(
//                        result));
//                instrument = (Instrument) xmlSer.read(reader);
//                return instrument;
//            } catch (IOException | ClassNotFoundException | IllegalAccessException | InstantiationException | InvocationTargetException e) {
//                e.printStackTrace();
//            }
//        }

        return soundObject;
    }

    public static boolean submitSoundObject(String username, String password,
            int categoryId, String name, String soundObjectType,
            String description, String soundObjectText) throws IOException,
            XmlRpcException {

        Vector v = new Vector();

        v.add(username);
        v.add(password);
        v.add(new Integer(categoryId));
        v.add(name);
        v.add(soundObjectType);
        v.add(description);
        v.add(soundObjectText);

        String result;

        result = (String) xrpc.execute("blueShare.submitSoundObject", v);

        return true;
    }

    public static boolean removeSoundObject(String username, String password,
            int soundObjectId) throws XmlRpcException, IOException {

        Vector v = new Vector();
        v.add(username);
        v.add(password);
        v.add(new Integer(soundObjectId));

        return (Boolean) xrpc.execute("blueShare.removeSoundObject", v);
    }

    
    /* UTILITY METHODS */

    private static String checkNullString(String stringToCheck) {
        if (stringToCheck == null) {;
            return "";
        }
        return stringToCheck;
    }

}