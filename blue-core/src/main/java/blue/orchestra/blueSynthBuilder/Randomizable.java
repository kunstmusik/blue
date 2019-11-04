package blue.orchestra.blueSynthBuilder;

/**
 * Interface to be implemented by BSB Widgets which can be randomizable; allows
 * user to set if it should be randomizable, as well as has method to randomize
 * itself
 * 
 * @author SYi
 * 
 */

public interface Randomizable {

    public boolean isRandomizable();

    public void setRandomizable(boolean randomizable);

    public void randomize();

}
