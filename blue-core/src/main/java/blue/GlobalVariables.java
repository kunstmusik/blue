package blue;

import java.util.HashMap;
import java.util.Map;

public class GlobalVariables {
    private static Map map = new HashMap();

    public static String USER_CONFIG_DIR = "userConfigurationDirectory";

    public static void set(String key, String val) {
        map.put(key, val);
    }

    public static String get(String key) {
        return (String) map.get(key);
    }
}
