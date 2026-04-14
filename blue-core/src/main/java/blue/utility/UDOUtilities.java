/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.utility;

import blue.udo.OpcodeList;
import blue.udo.UDOStyle;
import blue.udo.UserDefinedOpcode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @author Steven Yi
 */
public class UDOUtilities {

    private static final Pattern XIN_LINE_PATTERN = Pattern.compile("\\bxin\\b\\s*$");
    private static final Pattern MODERN_UDO_PATTERN = Pattern.compile(
            "^([^\\(]+)\\((.*)\\)\\s*:\\s*(.+)$", Pattern.DOTALL);

    public static OpcodeList parseUDOText(final String udoText) {
        OpcodeList retVal = new OpcodeList();

        String cleanedText = TextUtilities.stripMultiLineComments(udoText);
        int state = 0;

        UserDefinedOpcode currentUDO = null;
        StringBuilder codeBody = null;
        StringBuilder declaration = null;

        String[] lines = cleanedText.split("\n", -1);

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            switch (state) {
                case 0:
                    currentUDO = parseUDODeclaration(line);
                    if (currentUDO != null) {
                        codeBody = new StringBuilder();
                        state = 1;
                    } else if (TextUtilities.stripSingleLineComments(line.trim())
                            .startsWith("opcode")) {
                        declaration = new StringBuilder(line.trim());
                        state = 2;
                    }

                    break;
                case 1:

                    if (line.trim().startsWith("opcode")) {
                        currentUDO = null;
                        state = 0;
                    } else if (line.trim().startsWith("endop")) {
                        finalizeParsedUDO(currentUDO, codeBody.toString());

                        retVal.add(currentUDO);

                        currentUDO = null;
                        state = 0;
                    } else {
                        codeBody.append(line).append("\n");
                    }

                    break;
                case 2:
                    if (isInstrOrUDODeclarationBoundary(line.trim())) {
                        declaration = null;
                        state = 0;
                        i--;
                        break;
                    }

                    if (!line.isBlank()) {
                        declaration.append("\n").append(line.trim());
                    }

                    currentUDO = parseUDODeclaration(declaration.toString());
                    if (currentUDO != null) {
                        codeBody = new StringBuilder();
                        declaration = null;
                        state = 1;
                    }

                    break;
            }
        }

        return retVal;
    }

    static boolean isInstrOrUDODeclarationBoundary(String trimmedLine) {
        return trimmedLine.startsWith("opcode")
                || trimmedLine.startsWith("instr")
                || trimmedLine.startsWith("endop")
                || trimmedLine.startsWith("endin");
    }

    public static UserDefinedOpcode parseUDODeclaration(String line) {
        String trimmedLine = TextUtilities.stripSingleLineComments(line.trim());
        if (!trimmedLine.startsWith("opcode")) {
            return null;
        }

        String declaration = trimmedLine.substring(6).trim();
        Matcher modernMatcher = MODERN_UDO_PATTERN.matcher(declaration);

        if (modernMatcher.matches()) {
            UserDefinedOpcode udo = new UserDefinedOpcode();
            udo.style = UDOStyle.MODERN;
            udo.opcodeName = modernMatcher.group(1).trim();
            udo.inputArguments = modernMatcher.group(2).trim();
            udo.outTypes = getModernOutTypesFromSignature(modernMatcher.group(3));
            return udo;
        }

        String[] parts = declaration.split(",", 3);
        if (parts.length == 3) {
            UserDefinedOpcode udo = new UserDefinedOpcode();
            udo.style = UDOStyle.CLASSIC;
            udo.opcodeName = parts[0].trim();
            udo.outTypes = parts[1].trim();
            udo.inTypes = parts[2].trim();
            return udo;
        }

        return null;
    }

    public static void finalizeParsedUDO(UserDefinedOpcode udo, String codeBody) {
        udo.codeBody = codeBody;
    }

    public static String getInTypesFromInputArguments(String inputArguments) {
        if (inputArguments == null || inputArguments.isBlank()) {
            return "";
        }

        StringBuilder buffer = new StringBuilder();

        for (String inputArgument : splitCommaSeparated(inputArguments)) {
            String typeToken = getTypeTokenFromInputArgument(inputArgument);
            if (typeToken.isBlank()) {
                return "";
            }
            buffer.append(typeToken);
        }

        return buffer.toString();
    }

    public static String getModernOutputSignature(String outTypes) {
        String trimmed = normalizeModernOutTypes(outTypes);
        if (trimmed.isEmpty()) {
            return "void";
        }
        List<String> typeTokens = parseTypeTokens(trimmed);
        if (typeTokens.isEmpty()) {
            return trimmed;
        }
        if (typeTokens.size() == 1) {
            return typeTokens.get(0);
        }
        return "(" + String.join(",", typeTokens) + ")";
    }

    public static String getModernOutTypesDisplay(String outTypes) {
        String trimmed = normalizeModernOutTypes(outTypes);
        return trimmed.isEmpty() ? "void" : trimmed;
    }

    public static String normalizeModernOutTypesForComparison(String outTypes) {
        String trimmed = normalizeModernOutTypes(outTypes);
        if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
            trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed.replaceAll("\\s*,\\s*", ",");
    }

    public static String getInputArgumentsFromCodeBody(String codeBody) {
        for (String line : codeBody.split("\n", -1)) {
            String trimmedLine = TextUtilities.stripSingleLineComments(line).trim();
            Matcher matcher = XIN_LINE_PATTERN.matcher(trimmedLine);
            if (matcher.find()) {
                return trimmedLine.substring(0, matcher.start()).trim();
            }
        }

        return "";
    }

    public static void convertToModern(UserDefinedOpcode udo) {
        String convertedInputArguments = getInputArgumentsFromCodeBody(udo.codeBody);
        if (convertedInputArguments.isBlank()) {
            convertedInputArguments = getInputArgumentsFromTypeString(udo.inTypes);
        } else {
            convertedInputArguments = applyLegacyTypeAnnotations(
                    convertedInputArguments, udo.inTypes);
        }

        udo.inputArguments = convertedInputArguments;
        udo.codeBody = trimLeadingBlankLines(removeXinLines(udo.codeBody));
        udo.outTypes = joinedOutTypesToCommaSeparated(udo.outTypes);
        udo.inTypes = "";

        udo.style = UDOStyle.MODERN;
    }

    public static void convertToClassic(UserDefinedOpcode udo) {
        String derivedInTypes = getInTypesFromInputArguments(udo.inputArguments);
        if (!derivedInTypes.isBlank()) {
            udo.inTypes = derivedInTypes;
        } else {
            udo.inTypes = "0";
        }

        udo.outTypes = commaSeparatedOutTypesToJoined(udo.outTypes);

        String cleanedCodeBody = trimLeadingBlankLines(removeXinLines(udo.codeBody));
        if (udo.inputArguments.isBlank()) {
            udo.codeBody = cleanedCodeBody;
        } else {
            udo.codeBody = stripTypeAnnotations(udo.inputArguments) + "\txin\n"
                    + cleanedCodeBody;
        }

        udo.inputArguments = "";
        udo.style = UDOStyle.CLASSIC;
    }

    private static String getModernOutTypesFromSignature(String outputSignature) {
        String trimmed = outputSignature.trim();
        if (trimmed.equals("void") || trimmed.equals("0") || trimmed.isEmpty()) {
            return "";
        }
        if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
            return normalizeModernOutTypes(
                    trimmed.substring(1, trimmed.length() - 1).trim());
        }
        return trimmed;
    }

    private static String joinedOutTypesToCommaSeparated(String joinedTypes) {
        String trimmed = normalizeClassicOutTypes(joinedTypes);
        if (trimmed.equals("0")) {
            return "";
        }
        List<String> tokens = parseTypeTokens(trimmed);
        if (tokens.isEmpty()) {
            return "";
        }
        return String.join(", ", tokens);
    }

    private static String commaSeparatedOutTypesToJoined(String commaSeparated) {
        String trimmed = commaSeparated.trim();
        if (trimmed.equals("void") || trimmed.equals("0")) {
            return "0";
        }
        List<String> tokens = parseTypeTokens(trimmed);
        return tokens.isEmpty() ? "0" : buildTypeString(tokens);
    }

    private static String getInputArgumentsFromTypeString(String inTypes) {
        List<String> typeTokens = parseTypeTokens(inTypes);
        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < typeTokens.size(); i++) {
            if (i > 0) {
                buffer.append(", ");
            }

            String typeToken = typeTokens.get(i);
            String baseType = typeToken.startsWith("S")
                    ? "S"
                    : String.valueOf(mapClassicInputTypeToVariablePrefix(
                            typeToken.charAt(0)));

            buffer.append(baseType).append("In").append(i + 1);

            if (requiresTypeAnnotation(typeToken, baseType)) {
                buffer.append(":").append(typeToken);
            }

            if (typeToken.endsWith("[]")) {
                if (!requiresTypeAnnotation(typeToken, baseType)) {
                    buffer.append("[]");
                }
            }
        }

        return buffer.toString();
    }

    private static char mapClassicInputTypeToVariablePrefix(char inputType) {
        return switch (inputType) {
            case 'o', 'j' -> 'k';
            default -> inputType;
        };
    }

    private static String removeXinLines(String codeBody) {
        ArrayList<String> lines = new ArrayList<>();

        for (String line : codeBody.split("\n", -1)) {
            String trimmedLine = TextUtilities.stripSingleLineComments(line).trim();
            Matcher matcher = XIN_LINE_PATTERN.matcher(trimmedLine);
            if (!matcher.find()) {
                lines.add(line);
            }
        }

        return String.join("\n", lines);
    }

    private static String trimLeadingBlankLines(String text) {
        String retVal = text;
        while (retVal.startsWith("\n")) {
            retVal = retVal.substring(1);
        }
        return retVal;
    }

    private static String getTypeTokenFromInputArgument(String inputArgument) {
        String token = inputArgument.trim();
        int equalsIndex = token.indexOf('=');
        if (equalsIndex >= 0) {
            token = token.substring(0, equalsIndex).trim();
        }

        int spaceIndex = token.lastIndexOf(' ');
        if (spaceIndex >= 0) {
            token = token.substring(spaceIndex + 1).trim();
        }

        int colonIndex = token.lastIndexOf(':');
        if (colonIndex >= 0 && colonIndex < token.length() - 1) {
            return normalizeTypeToken(token.substring(colonIndex + 1));
        }

        boolean arrayType = token.endsWith("[]");
        if (arrayType) {
            token = token.substring(0, token.length() - 2).trim();
        }

        if (token.isEmpty()) {
            return "";
        }

        char prefix = token.charAt(0);
        if (!isVariableRatePrefix(prefix)) {
            return "";
        }

        return String.valueOf(prefix) + (arrayType ? "[]" : "");
    }

    private static boolean isVariableRatePrefix(char prefix) {
        return prefix == 'a' || prefix == 'k' || prefix == 'i'
                || prefix == 'S' || prefix == 'f';
    }

    private static List<String> parseTypeTokens(String typeSpec) {
        ArrayList<String> typeTokens = new ArrayList<>();
        if (typeSpec == null) {
            return typeTokens;
        }

        String trimmedSpec = typeSpec.trim();
        if (trimmedSpec.isEmpty() || trimmedSpec.equals("0")) {
            return typeTokens;
        }

        if (trimmedSpec.startsWith("(") && trimmedSpec.endsWith(")")) {
            for (String part : splitCommaSeparated(trimmedSpec.substring(1,
                    trimmedSpec.length() - 1))) {
                String normalizedTypeToken = normalizeTypeToken(part);
                if (!normalizedTypeToken.isEmpty()) {
                    typeTokens.add(normalizedTypeToken);
                }
            }
            return typeTokens;
        }

        int index = 0;
        while (index < trimmedSpec.length()) {
            char currentChar = trimmedSpec.charAt(index);
            if (Character.isWhitespace(currentChar) || currentChar == ','
                    || currentChar == '(' || currentChar == ')') {
                index++;
                continue;
            }

            if (isTypeTokenStart(currentChar)) {
                StringBuilder buffer = new StringBuilder();
                buffer.append(currentChar);
                if ((index + 2) < trimmedSpec.length()
                        && trimmedSpec.charAt(index + 1) == '['
                        && trimmedSpec.charAt(index + 2) == ']') {
                    buffer.append("[]");
                    index += 3;
                } else {
                    index++;
                }
                typeTokens.add(buffer.toString());
            } else {
                index++;
            }
        }

        return typeTokens;
    }

    private static boolean isTypeTokenStart(char currentChar) {
        return currentChar == 'a' || currentChar == 'k' || currentChar == 'i'
                || currentChar == 'S' || currentChar == 'f'
                || currentChar == 'o' || currentChar == 'j';
    }

    private static String normalizeTypeToken(String typeToken) {
        String trimmedTypeToken = typeToken.trim();
        if (trimmedTypeToken.isEmpty() || trimmedTypeToken.equals("0")) {
            return "";
        }

        if (trimmedTypeToken.endsWith("[]") && trimmedTypeToken.length() >= 3) {
            return trimmedTypeToken.substring(0, trimmedTypeToken.length() - 2)
                    + "[]";
        }

        return trimmedTypeToken;
    }

    private static String buildTypeString(List<String> typeTokens) {
        StringBuilder buffer = new StringBuilder();
        for (String typeToken : typeTokens) {
            buffer.append(typeToken);
        }
        return buffer.toString();
    }

    private static List<String> splitCommaSeparated(String text) {
        ArrayList<String> values = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return values;
        }

        StringBuilder currentValue = new StringBuilder();
        int parenthesisDepth = 0;
        int bracketDepth = 0;
        int braceDepth = 0;

        for (int i = 0; i < text.length(); i++) {
            char currentChar = text.charAt(i);
            switch (currentChar) {
                case '(' ->
                    parenthesisDepth++;
                case ')' ->
                    parenthesisDepth = Math.max(0, parenthesisDepth - 1);
                case '[' ->
                    bracketDepth++;
                case ']' ->
                    bracketDepth = Math.max(0, bracketDepth - 1);
                case '{' ->
                    braceDepth++;
                case '}' ->
                    braceDepth = Math.max(0, braceDepth - 1);
                default -> {
                }
            }

            if (currentChar == ',' && parenthesisDepth == 0 && bracketDepth == 0
                    && braceDepth == 0) {
                String value = currentValue.toString().trim();
                if (!value.isEmpty()) {
                    values.add(value);
                }
                currentValue.setLength(0);
            } else {
                currentValue.append(currentChar);
            }
        }

        String value = currentValue.toString().trim();
        if (!value.isEmpty()) {
            values.add(value);
        }

        return values;
    }

    private static String applyLegacyTypeAnnotations(String inputArguments,
            String inTypes) {
        List<String> arguments = splitCommaSeparated(inputArguments);
        List<String> typeTokens = parseTypeTokens(inTypes);

        if (arguments.size() != typeTokens.size()) {
            return inputArguments;
        }

        ArrayList<String> annotatedArguments = new ArrayList<>(arguments.size());

        for (int i = 0; i < arguments.size(); i++) {
            String argument = arguments.get(i).trim();
            String typeToken = typeTokens.get(i);
            if (argument.isEmpty()) {
                return inputArguments;
            }

            if (needsAnnotation(argument, typeToken)) {
                annotatedArguments.add(argument + ":" + typeToken);
            } else {
                annotatedArguments.add(argument);
            }
        }

        return String.join(", ", annotatedArguments);
    }

    private static boolean needsAnnotation(String inputArgument, String typeToken) {
        if (typeToken == null || typeToken.isBlank()) {
            return false;
        }

        String normalizedTypeToken = normalizeTypeToken(typeToken);
        if (normalizedTypeToken.isBlank()) {
            return false;
        }

        String derivedTypeToken = getTypeTokenFromInputArgument(inputArgument);
        return !normalizedTypeToken.equals(derivedTypeToken);
    }

    private static boolean requiresTypeAnnotation(String typeToken,
            String generatedPrefix) {
        String normalizedTypeToken = normalizeTypeToken(typeToken);
        if (normalizedTypeToken.isBlank()) {
            return false;
        }

        String expectedToken = generatedPrefix + (normalizedTypeToken.endsWith("[]")
                ? "[]" : "");
        return !normalizedTypeToken.equals(expectedToken);
    }

    private static String stripTypeAnnotations(String inputArguments) {
        ArrayList<String> variableNames = new ArrayList<>();

        for (String inputArgument : splitCommaSeparated(inputArguments)) {
            String argument = inputArgument.trim();
            int equalsIndex = argument.indexOf('=');
            if (equalsIndex >= 0) {
                argument = argument.substring(0, equalsIndex).trim();
            }

            int colonIndex = argument.lastIndexOf(':');
            if (colonIndex >= 0) {
                argument = argument.substring(0, colonIndex).trim();
            }

            variableNames.add(argument);
        }

        return String.join(", ", variableNames);
    }

    public static String normalizeModernOutTypes(String outTypes) {
        if (outTypes == null) {
            return "";
        }

        String trimmed = outTypes.trim();
        if (trimmed.isEmpty() || trimmed.equals("0") || trimmed.equals("void")) {
            return "";
        }

        if (trimmed.equals("()")) {
            return "";
        }

        return trimmed;
    }

    public static String normalizeClassicOutTypes(String outTypes) {
        if (outTypes == null) {
            return "0";
        }

        String trimmed = outTypes.trim();
        if (trimmed.isEmpty() || trimmed.equals("void")) {
            return "0";
        }

        return trimmed;
    }

    /**
     * Given a list of Opcodes, append them to the passed in master list. A
     * hashmap filled with key-value pairs of old UDO names to newly assigned
     * UDO names will be returned. The returned map may not contain any values
     * if no replacement of names are needed.
     * 
     * @param newList
     * @param masterList
     * @return
     */

    public static HashMap<String, String> appendUserDefinedOpcodes(OpcodeList newList,
            OpcodeList masterList) {
        HashMap<String, String> keyValues = new HashMap<>();

        for (UserDefinedOpcode udo : newList) {
            if (keyValues.size() > 0) {
                udo.codeBody = TextUtilities.replaceOpcodeNames(keyValues,
                        udo.codeBody);
            }

            String oldName = udo.getOpcodeName();
            String newName = masterList.getNameOfEquivalentCopy(udo);

            if (newName == null) {

                if (!masterList.isNameUnique(oldName)) {
                    newName = masterList.getUniqueName();
                    udo.setOpcodeName(newName);
                }

                masterList.addOpcode(udo);
            }

            if (newName != null && !newName.equals(oldName)) {
                keyValues.put(oldName, newName);
            }
        }

        return keyValues;
    }

}
