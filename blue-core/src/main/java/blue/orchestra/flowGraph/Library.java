package blue.orchestra.flowGraph;

public class Library {
    private final String name;

    private final String[] branch;

    private final int numBranches;

    private int numUnits;
    private final int maxUnits;

    private final String[] unitName;

    private final String[] unitCode;

    private final int[] unitBranch;

    public Library() {
        name = "Unit Library";

        numBranches = 2;
        branch = new String[numBranches];
        branch[0] = "Opcodes";
        branch[1] = "User Defined Units";

        numUnits = 0;
        maxUnits = 20;

        /*
         * Load-Save islerini ogrendikten sonra bunlari sil
         */
        unitName = new String[maxUnits];
        unitCode = new String[maxUnits];
        unitBranch = new int[maxUnits];

        unitName[0] = "Oscillator 1";
        unitCode[0] = "ares	oscil	kamp, kcps, ifn";
        unitBranch[0] = 0;

        unitName[1] = "Envelope 1";
        unitCode[1] = "kamp	line	ia, idur1, ib";
        unitBranch[1] = 0;

        unitName[2] = "Empty_Unit";
        unitCode[2] = "";
        unitBranch[2] = 1;

        unitName[3] = "myDelay";
        unitCode[3] = "adel	delayr	idlt\n	delayw	ain";
        unitBranch[3] = 1;

        numUnits = 4;
    }

    public String getName() {
        return name;
    }

    public String getUnitName(int n) {
        return unitName[n];
    }

    public String getUnitCode(int n) {
        return unitCode[n];
    }

    public int getUnitBranch(int n) {
        return unitBranch[n];
    }

    public int getNumUnits() {
        return numUnits;
    }

    public int getNumBranches() {
        return numBranches;
    }

    public String getBranchName(int n) {
        return branch[n];
    }

    public void addUnit(Unit newUnit) {
        if (numUnits < maxUnits) {
            unitName[numUnits] = newUnit.getName();
            unitBranch[numUnits] = 1;
            numUnits++;
        }

    }

    public void removeUnit(int n) {

    }

}
