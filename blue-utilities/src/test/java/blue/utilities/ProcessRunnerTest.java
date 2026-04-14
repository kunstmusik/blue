package blue.utilities;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ProcessRunner command string parsing.
 */
class ProcessRunnerTest {

    @Test
    void splitCommandString_simpleArgs() {
        String[] result = ProcessRunner.splitCommandString("csound -o test.wav test.csd");
        assertArrayEquals(new String[]{"csound", "-o", "test.wav", "test.csd"}, result);
    }

    @Test
    void splitCommandString_withTabs() {
        String[] result = ProcessRunner.splitCommandString("csound\t-o\ttest.wav\ttest.csd");
        assertArrayEquals(new String[]{"csound", "-o", "test.wav", "test.csd"}, result);
    }

    @Test
    void splitCommandString_withNewlines() {
        String[] result = ProcessRunner.splitCommandString("csound\n-o\ntest.wav\ntest.csd");
        assertArrayEquals(new String[]{"csound", "-o", "test.wav", "test.csd"}, result);
    }

    @Test
    void splitCommandString_withQuotedArgs() {
        String[] result = ProcessRunner.splitCommandString("csound -o \"output file.wav\" test.csd");
        assertArrayEquals(new String[]{"csound", "-o", "output file.wav", "test.csd"}, result);
    }

    @Test
    void splitCommandString_quotedWithSpaces() {
        String[] result = ProcessRunner.splitCommandString("\"path to csound\" -o test.wav");
        assertArrayEquals(new String[]{"path to csound", "-o", "test.wav"}, result);
    }

    @Test
    void splitCommandString_emptyInput() {
        String[] result = ProcessRunner.splitCommandString("");
        assertArrayEquals(new String[]{}, result);
    }

    @Test
    void splitCommandString_whitespaceOnly() {
        String[] result = ProcessRunner.splitCommandString("   \t\n  ");
        assertArrayEquals(new String[]{}, result);
    }

    @Test
    void splitCommandString_singleArg() {
        String[] result = ProcessRunner.splitCommandString("csound");
        assertArrayEquals(new String[]{"csound"}, result);
    }

    @Test
    void splitCommandString_quotedSingleArg() {
        String[] result = ProcessRunner.splitCommandString("\"single quoted arg\"");
        assertArrayEquals(new String[]{"single quoted arg"}, result);
    }

    @Test
    void splitCommandString_mixedQuotesAndSpaces() {
        String[] result = ProcessRunner.splitCommandString("  csound   \"arg with spaces\"   -flag  ");
        assertArrayEquals(new String[]{"csound", "arg with spaces", "-flag"}, result);
    }

    @Test
    void splitCommandString_multipleQuotedArgs() {
        String[] result = ProcessRunner.splitCommandString("\"arg one\" \"arg two\" \"arg three\"");
        assertArrayEquals(new String[]{"arg one", "arg two", "arg three"}, result);
    }
}
